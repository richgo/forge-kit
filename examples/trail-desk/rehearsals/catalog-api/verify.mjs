import assert from 'node:assert/strict';

const apiPath = '/api/v1/trails';

export async function verify({ page, origin, acceptance, catalog }) {
  const apiUrl = new URL(apiPath, origin).href;
  const response = await fetch(apiUrl, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, 'GET must serve the catalog');
  assert.match(response.headers.get('content-type') ?? '', /^application\/json(?:;|$)/i);
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ['trails']);
  assert.deepEqual(payload.trails, catalog.trails, 'The endpoint must return the approved trail data in catalog order');

  const [browserResponse] = await Promise.all([
    page.waitForResponse(response => response.url() === apiUrl && response.request().method() === 'GET'),
    page.goto(origin),
  ]);
  assert.equal(browserResponse.status(), 200);
  await page.locator('[data-trail="lake"]').waitFor();
  const visible = () => page.locator('[data-trail]:visible').evaluateAll(cards => cards.map(card => card.dataset.trail));
  const observations = {};
  const observe = async id => {
    const criterion = acceptance.find(check => check.id === id.toLowerCase());
    assert.ok(criterion, 'Missing protected acceptance criterion ' + id);
    const trails = await visible();
    assert.deepEqual(trails, criterion.then.visibleTrails, id);
    observations[id] = trails;
  };
  const sort = page.getByRole('combobox', { name: 'Sort by distance' });
  const filter = page.getByRole('checkbox', { name: 'Step-free only' });
  await observe('AC-101');
  await filter.check();
  await observe('AC-102');
  await filter.uncheck();
  await observe('AC-103');
  await sort.selectOption('shortest');
  await observe('AC-104');
  await sort.selectOption('longest');
  await observe('AC-105');
  await filter.check();
  await observe('AC-106');
  assert.equal(await page.locator('#count').textContent(), '2 trails');
  await filter.uncheck();
  await sort.selectOption('catalog');
  await observe('AC-107');
  const replacement = {
    id: 'api-only', name: '<b>API-only trail</b>', distance: '1.2 km', terrain: 'Meadow',
    description: 'This trail only exists in the response.', stepFree: true,
  };
  const serveReplacement = route => route.fulfill({ json: { trails: [replacement] } });
  await page.route(apiUrl, serveReplacement);
  try {
    await page.reload();
    await page.getByRole('heading', { name: replacement.name, exact: true }).waitFor();
    assert.deepEqual(await visible(), ['api-only']);
    assert.equal(await page.locator('#count').textContent(), '1 trails');
  } finally {
    await page.unroute(apiUrl, serveReplacement);
  }
  return { ...observations, endpoint: apiPath, usesEndpointData: true };
}
