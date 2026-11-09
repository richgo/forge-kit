
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const inputs = ['index.html', 'architecture.json', 'architecture.c4'];
const sortChoices = { 'sort-shortest': 'shortest', 'sort-longest': 'longest', 'sort-longest-step-free': 'longest', 'reset-sort': 'catalog' };
const actions = {
  'open-catalog': 'trail_catalog',
  'filter-step-free': 'step_free_filter',
  'clear-filter': 'step_free_filter',
  ...Object.fromEntries(Object.keys(sortChoices).map(action => [action, 'distance_sort'])),
};
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function trace(spec) {
  assert.equal(spec.schemaVersion, 1);
  assert.equal(spec.product, 'Trail Desk');
  assert.ok(spec.trails.length > 0);
  const ids = new Set(spec.trails.map(trail => trail.id));
  assert.equal(ids.size, spec.trails.length);
  for (const { id, name, distance, terrain, description, stepFree } of spec.trails) {
    assert.match(id, /^[a-z][a-z0-9-]*$/);
    assert.ok([name, distance, terrain, description].every(value => typeof value === 'string' && value.length > 0));
    assert.equal(typeof stepFree, 'boolean');
  }
  const seen = new Set();
  const register = (item, prefix, fields) => {
    assert.equal(typeof item.id, 'string');
    assert.match(item.id, new RegExp('^' + prefix + '-[0-9]+$'));
    assert.ok(!seen.has(item.id), 'Duplicate requirements ID ' + item.id);
    seen.add(item.id);
    for (const field of fields) {
      assert.ok(typeof item[field] === 'string' && item[field].trim(), 'Missing ' + item.id + ' ' + field);
    }
  };
  const list = (items, label) => {
    assert.ok(Array.isArray(items) && items.length > 0, 'Expected ' + label);
    return items;
  };
  const rows = [];
  for (const epic of list(spec.epics, 'epics')) {
    register(epic, 'EPIC', ['title', 'outcome']);
    for (const feature of list(epic.features, 'features')) {
      register(feature, 'FEAT', ['title', 'outcome']);
      for (const story of list(feature.stories, 'stories')) {
        register(story, 'STORY', ['title', 'asA', 'iWant', 'soThat']);
        for (const criterion of list(story.acceptanceCriteria, 'acceptance criteria')) {
          register(criterion, 'AC', ['given', 'when']);
          assert.deepEqual(Object.keys(criterion).sort(), ['given', 'id', 'then', 'when'], 'Unexpected acceptance fields');
          const { id, given, when, then } = criterion;
          assert.ok(Object.hasOwn(actions, when), 'Unsupported website acceptance: ' + when);
          assert.equal(story.architectureNode, actions[when], 'Wrong CALM owner for ' + id);
          assert.deepEqual(Object.keys(then), ['visibleTrails']);
          const { visibleTrails } = then;
          assert.ok(Array.isArray(visibleTrails) && visibleTrails.every(trail => ids.has(trail)) &&
            new Set(visibleTrails).size === visibleTrails.length, 'Invalid expected trail IDs for ' + id);
          rows.push({ epic: epic.id, feature: feature.id, story: story.id, node: story.architectureNode, id, given, when, then });
        }
      }
    }
  }
  assert.ok(rows.some(row => row.when === 'open-catalog'), 'The catalog needs an acceptance criterion.');
  return rows;
}

function websiteModel({ hasFilter, hasSort, combined }) {
  const node = (id, type, name, description) => ({ 'unique-id': id, 'node-type': type, name, description });
  const edge = (source, destination, description) => ({
    'unique-id': source + '-' + destination, description,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
  });
  const architecture = {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [
      node('visitor', 'actor', 'Trail visitor', 'Browses the public trail catalog.'),
      node('browser', 'webclient', 'Web browser', 'Renders the static HTML over HTTPS.'),
      node('pages', 'service', 'GitHub Pages', 'Serves the checked static release.'),
      node('trail_catalog', 'data-asset', 'Trail catalog', 'Trail cards embedded in the released HTML.'),
    ],
    relationships: [
      edge('visitor', 'browser', 'Opens Trail Desk.'),
      edge('browser', 'pages', 'Requests the static release over HTTPS.'),
      edge('pages', 'trail_catalog', 'Serves the catalog in index.html.'),
    ],
  };
  if (hasFilter) {
    architecture.nodes.push(node('step_free_filter', 'service', 'Step-free filter', 'Runs in the browser and filters rendered trail cards.'));
    architecture.relationships.push(edge('browser', 'step_free_filter', 'Executes the inline browser filter.'),
      edge('step_free_filter', 'trail_catalog', 'Reads the step-free metadata in the trail cards.'));
  }
  if (hasSort) {
    architecture.nodes.push(node('distance_sort', 'service', 'Distance sorting', 'Orders rendered trail cards by distance in the browser.'));
    architecture.relationships.push(edge('browser', 'distance_sort', 'Executes the inline distance sort.'),
      edge('distance_sort', 'trail_catalog', 'Reads distance values from the trail cards.'));
  }
  if (combined) architecture.relationships.push(edge('distance_sort', 'step_free_filter', 'Preserves the active accessibility filter.'));
  const types = [...new Set(architecture.nodes.map(item => item['node-type']))];
  const element = type => type.replaceAll('-', '_');
  const view = [
    'specification {', ...types.map(type => '  element ' + element(type)), '}', 'model {',
    ...architecture.nodes.map(item => '  ' + item['unique-id'] + ' = ' + element(item['node-type']) + " '" + item.name + "'"),
    ...architecture.relationships.map(item => {
      const { source, destination } = item['relationship-type'].connects;
      return '  ' + source.node + ' -> ' + destination.node + " '" + item.description + "'";
    }),
    '}', 'views {', '  view landscape {', '    include *', '  }', '}', '',
  ].join('\n');
  return { architecture, view };
}

function render(spec, architecture) {
  const hasFilter = architecture.nodes.some(node => node['unique-id'] === 'step_free_filter');
  const hasSort = architecture.nodes.some(node => node['unique-id'] === 'distance_sort');
  const cards = spec.trails.map(trail => [
    '<article data-trail="' + trail.id + '" data-step-free="' + trail.stepFree + '"' +
      (hasSort ? ' data-distance-km="' + Number.parseFloat(trail.distance) + '"' : '') + '>',
    '<div class="tag">' + escape(trail.terrain) + '</div>',
    '<h2>' + escape(trail.name) + '</h2><p>' + escape(trail.description) + '</p>',
    '<footer>' + escape(trail.distance) + (trail.stepFree ? ' · Step-free' : ' · Uneven terrain') + '</footer>',
    '</article>',
  ].join('')).join('\n');
  const filter = hasFilter ? '<label><input id="step-free" type="checkbox"> Step-free only</label>' : '';
  const filterScript = hasFilter ? [
    '<script>',
    'const filter = document.querySelector("#step-free");',
    'const trails = [...document.querySelectorAll("[data-trail]")];',
    'const updateTrails = () => {',
    '  for (const trail of trails) trail.hidden = filter.checked && trail.dataset.stepFree !== "true";',
    '  document.querySelector("#count").textContent = trails.filter(trail => !trail.hidden).length + " trails";',
    '};',
    'filter.addEventListener("change", updateTrails); updateTrails();',
    '</script>',
  ].join('\n') : '';
  const sort = hasSort
    ? '<label>Sort by distance <select id="distance-sort"><option value="catalog">Catalog order</option><option value="shortest">Shortest first</option><option value="longest">Longest first</option></select></label>'
    : '';
  const sortScript = hasSort ? [
    '<script>',
    '(() => {',
    '  const order = document.querySelector("#distance-sort");',
    '  const catalog = document.querySelector(".grid");',
    '  const cards = [...catalog.querySelectorAll("[data-trail]")];',
    '  const distance = card => Number(card.dataset.distanceKm);',
    '  order.addEventListener("change", () => {',
    '    const ordered = [...cards];',
    '    if (order.value === "shortest") ordered.sort((left, right) => distance(left) - distance(right));',
    '    if (order.value === "longest") ordered.sort((left, right) => distance(right) - distance(left));',
    '    catalog.append(...ordered);',
    '  });',
    '})();',
    '</script>',
  ].join('\n') : '';
  const style = [
    (hasSort ? '.toolbar{flex-wrap:wrap}' : ''),
    ':root{font-family:system-ui,sans-serif;color:#19342b;background:#eef2e8}*{box-sizing:border-box}',
    'body{margin:0}header{background:linear-gradient(125deg,#12352d,#295848);color:#f8f3df;padding:clamp(2.7rem,8vw,6rem) max(6vw,calc((100vw - 68rem)/2))}',
    'header p{font-size:1.2rem;max-width:35rem;color:#d5e1cc}h1{font-family:Georgia,serif;font-size:clamp(3rem,10vw,6rem);margin:.25em 0}',
    '.eyebrow,.tag{font-size:.78rem;font-weight:750;letter-spacing:.13em;text-transform:uppercase}',
    'main{max-width:68rem;margin:auto;padding:2.5rem 1.5rem}.toolbar{display:flex;gap:1.2rem;align-items:center;justify-content:space-between;margin:0 0 1.3rem}',
    'label{border:1px solid #375f4e;border-radius:2rem;padding:.65rem 1rem;cursor:pointer}input{accent-color:#245244}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1rem}',
    'article{border:1px solid #d7dfd1;border-radius:1rem;background:#fffdf5;padding:1.5rem;box-shadow:0 .6rem 1.6rem #152c2210}',
    '.tag{color:#395d41}h2{font-family:Georgia,serif;font-size:1.8rem;margin:.5em 0}article p{line-height:1.5}',
    'article footer{border-top:1px solid #d7dfd1;padding-top:.8rem;margin-top:1.4rem;font-weight:650}',
    '.about{margin:2.6rem 0 0;color:#375f4e}.about a{color:inherit}',
    '',
  ].join('\n');
  const hash = value => "'sha256-" + createHash('sha256').update(value).digest('base64') + "'";
  const scriptHashes = [filterScript, sortScript].filter(Boolean)
    .map(script => hash(script.slice('<script>'.length, -'</script>'.length)));
  const policy = [
    "default-src 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'none'", "connect-src 'none'",
    'script-src ' + (scriptHashes.join(' ') || "'none'"), 'style-src ' + hash(style),
  ].join('; ');
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="' + policy + '">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Trail Desk</title>',
    '<style>' + style + '</style></head><body>',
    '<header><span class="eyebrow">The field guide</span><h1>Trail Desk</h1><p>Pick a route before you head out. Compare distance, terrain, and access on three fictional trails.</p></header>',
    '<main><div class="toolbar"><strong id="count" aria-live="polite">' + spec.trails.length + ' trails</strong>' + filter + sort + '</div>',
    '<section class="grid" aria-label="Trail catalog">' + cards + '</section>',
    '<p class="about"><a href="architecture.json">CALM architecture</a> · <a href="architecture.c4">LikeC4 view</a> · <a href="release.json">Release evidence</a></p></main>',
    filterScript + sortScript, '</body></html>', '',
  ].join('\n');
}

export function buildWebsite(spec) {
  const acceptance = trace(spec);
  const hasFilter = acceptance.some(row => row.node === 'step_free_filter');
  const hasSort = acceptance.some(row => row.node === 'distance_sort');
  if (hasSort) {
    for (const trail of spec.trails) {
      assert.match(trail.distance, /^[0-9]+(?:\.[0-9]+)? km$/, 'Sorting requires distance in kilometres');
      assert.ok(Number.isFinite(Number.parseFloat(trail.distance)), 'Distance must be finite');
    }
  }
  const combined = acceptance.some(row => row.when === 'sort-longest-step-free');
  if (combined) {
    assert.ok(hasFilter, 'Combined sorting requires the step-free filter');
  }
  const { architecture, view } = websiteModel({ hasFilter, hasSort, combined });
  return { architecture, view, html: render(spec, architecture), acceptance };
}

function websiteReport({ requirements, architecture, view, html, acceptance }) {
  return {
    requirementsSha256: digest(requirements),
    architectureSha256: digest(architecture),
    viewSha256: digest(view),
    siteSha256: digest(html),
    acceptance: acceptance.map(item => item.id),
  };
}
async function verifyWebsite(specFile, output) {
  const approved = await readFile(specFile);
  assert.deepEqual(await readFile(join(output, 'product-requirements.json')), approved, 'Requirements bytes differ');
  const expected = buildWebsite(JSON.parse(approved));
  assert.equal(await readFile(join(output, 'architecture.json'), 'utf8'), json(expected.architecture), 'CALM architecture drift');
  assert.equal(await readFile(join(output, 'architecture.c4'), 'utf8'), expected.view, 'LikeC4 projection drift');
  const html = await readFile(join(output, 'index.html'));
  assert.equal(digest(html), digest(expected.html), 'Website HTML differs from the approved render');
  const securityEntry = 'checks/website-security.mjs';
  const securityPackage = process.env.FORGE_SECURITY_PACKAGE;
  const { verifyWebsiteSecurity } = await import(securityPackage ?
    pathToFileURL(resolve(securityPackage, securityEntry)) :
    new URL('../apm_modules/richgo/forge-kit-skills/packages/security-review/' + securityEntry, import.meta.url));
  const { chromium } = await import(pathToFileURL(resolve(process.env.FORGE_PLAYWRIGHT)).href);
  const browser = await chromium.launch();
  try {
    const security = await verifyWebsiteSecurity({ browser, html });
    const page = await browser.newPage();
    const observations = [];
    for (const { id, when, then } of expected.acceptance) {
      await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
      const filter = page.getByRole('checkbox', { name: 'Step-free only' });
      if (when === 'filter-step-free') await filter.check();
      if (when === 'clear-filter') {
        await filter.check();
        await filter.uncheck();
      }
      if (Object.hasOwn(sortChoices, when)) {
        const order = page.getByRole('combobox', { name: 'Sort by distance' });
        if (when === 'sort-longest-step-free') await filter.check();
        if (when === 'reset-sort') await order.selectOption('longest');
        await order.selectOption(sortChoices[when]);
      }
      const visible = await page.locator('[data-trail]:visible').evaluateAll(elements => elements.map(node => node.dataset.trail));
      assert.deepEqual(visible, then.visibleTrails, id + ' browser acceptance failed');
      observations.push({ id, visible });
    }
    const report = websiteReport({
      requirements: approved, architecture: json(expected.architecture), view: expected.view,
      html, acceptance: observations,
    });
    assert.deepEqual(JSON.parse(await readFile(join(output, 'candidate-evidence.json'))), report,
      'Candidate report does not match independent observations');
    await writeFile(join(output, 'requirements-verification.json'), json(report));
    await writeFile(join(output, 'security-verification.json'), json(security));
    return observations;
  } finally {
    await browser.close();
  }
}

async function publish(output, site, source) {
  await mkdir(site);
  for (const name of inputs) await copyFile(join(output, name), join(site, name));
  const files = Object.fromEntries(await Promise.all(inputs.map(async name => [name, digest(await readFile(join(site, name)))])));
  const manifest = { source, files, release: digest(json({ source, files })) };
  await writeFile(join(site, 'release.json'), json(manifest));
}

async function probe(url, manifestPath) {
  const root = new URL(url);
  assert.equal(root.protocol, 'https:');
  assert.equal(root.username + root.password + root.search + root.hash, '');
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  const expected = JSON.parse(await readFile(manifestPath));
  const fetchBytes = async name => {
    const request = new URL(name, root);
    request.searchParams.set('release', expected.release + '-' + Date.now());
    const response = await fetch(request, { redirect: 'error', signal: AbortSignal.timeout(7000) });
    assert.ok(response.ok, name + ' returned ' + response.status);
    return Buffer.from(await response.arrayBuffer());
  };
  for (let attempt = 1; ; attempt++) {
    try {
      assert.deepEqual(JSON.parse(await fetchBytes('release.json')), expected);
      await Promise.all(inputs.map(async name => {
        assert.equal(digest(await fetchBytes(name)), expected.files[name], name + ' digest mismatch');
      }));
      console.log(json({ ...expected, url, observed: 'passed' }));
      return;
    } catch (error) {
      if (attempt === 12) throw error;
      await delay(5000);
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [command, first, second, third] = process.argv.slice(2);
  if (command === 'build') {
    const raw = await readFile(first);
    const { html, architecture, view, acceptance } = buildWebsite(JSON.parse(raw));
    const report = websiteReport({ requirements: raw, architecture: json(architecture), view, html, acceptance });
    await mkdir(second);
    await Promise.all([
      writeFile(join(second, 'product-requirements.json'), raw),
      writeFile(join(second, 'index.html'), html),
      writeFile(join(second, 'architecture.json'), json(architecture)),
      writeFile(join(second, 'architecture.c4'), view),
      writeFile(join(second, 'candidate-evidence.json'), json(report)),
    ]);
  } else if (command === 'verify') {
    const observations = await verifyWebsite(first, second);
    console.log(json({ observations }));
  } else if (command === 'package') {
    await publish(first, second, third);
  } else if (command === 'probe') {
    await probe(first, second);
  } else {
    throw new Error('Expected build, verify, package, or probe');
  }
}
