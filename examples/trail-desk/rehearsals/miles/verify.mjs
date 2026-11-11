import assert from 'node:assert/strict';

const catalogKilometers = [
  ['fern', '2.1 km · Step-free'],
  ['ridge', '5.8 km · Uneven terrain'],
  ['lake', '3.4 km · Step-free'],
];
const catalogMiles = [
  ['fern', '1.3 mi · Step-free'],
  ['ridge', '3.6 mi · Uneven terrain'],
  ['lake', '2.1 mi · Step-free'],
];

export async function verify({ page, origin }) {
  const response = await page.goto(origin);
  assert.ok(response?.ok(), 'Trail Desk must be served successfully');
  const units = page.getByRole('combobox', { name: 'Distance units', exact: true });
  const order = page.getByRole('combobox', { name: 'Sort by distance', exact: true });
  const filter = page.getByRole('checkbox', { name: 'Step-free only', exact: true });
  const visibleCards = () => page.locator('[data-trail]:visible').evaluateAll(cards =>
    cards.map(card => [card.dataset.trail, card.querySelector('footer').textContent.trim()]));

  assert.equal(await units.inputValue(), 'km', 'AC-108 must default to kilometers');
  const defaultDistances = await visibleCards();
  assert.deepEqual(defaultDistances, catalogKilometers, 'AC-108 must show original kilometer distances');

  await units.selectOption({ label: 'Miles' });
  const miles = await visibleCards();
  assert.deepEqual(miles, catalogMiles, 'AC-109 must show miles rounded to one decimal place');
  await units.selectOption({ label: 'Kilometers' });
  const restoredKilometers = await visibleCards();
  assert.deepEqual(restoredKilometers, catalogKilometers, 'AC-109 must restore the original distances');

  await units.selectOption({ label: 'Miles' });
  await order.selectOption({ label: 'Shortest first' });
  assert.deepEqual(await visibleCards(), [catalogMiles[0], catalogMiles[2], catalogMiles[1]],
    'AC-110 must sort miles shortest first');
  await filter.check();
  assert.deepEqual(await visibleCards(), [catalogMiles[0], catalogMiles[2]],
    'AC-110 must show only step-free trails in shortest-first order');
  await order.selectOption({ label: 'Longest first' });
  const longestStepFreeMiles = await visibleCards();
  assert.deepEqual(longestStepFreeMiles, [catalogMiles[2], catalogMiles[0]],
    'AC-110 must also sort step-free trails longest first');

  await units.selectOption({ label: 'Kilometers' });
  assert.equal(await order.inputValue(), 'longest', 'AC-110 must preserve the active sort');
  assert.equal(await filter.isChecked(), true, 'AC-110 must preserve the active filter');
  const longestStepFreeKilometers = await visibleCards();
  assert.deepEqual(longestStepFreeKilometers, [catalogKilometers[2], catalogKilometers[0]],
    'AC-110 must retain the filtered order after switching units');
  await filter.uncheck();
  assert.deepEqual(await visibleCards(), [catalogKilometers[1], catalogKilometers[2], catalogKilometers[0]],
    'AC-110 must restore all trails in the active sort order');
  await order.selectOption({ label: 'Catalog order' });
  assert.deepEqual(await visibleCards(), catalogKilometers, 'AC-110 must restore the original catalog order');

  return {
    'AC-108': { defaultDistances },
    'AC-109': { miles, restoredKilometers },
    'AC-110': { longestStepFreeMiles, longestStepFreeKilometers },
  };
}
