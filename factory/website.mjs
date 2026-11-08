
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const inputs = ['index.html', 'architecture.json', 'architecture.c4'];
const actions = { 'open-catalog': 'trail_catalog', 'filter-step-free': 'step_free_filter', 'clear-filter': 'step_free_filter' };
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
  const rows = spec.epics.flatMap(epic => epic.features.flatMap(feature => feature.stories.flatMap(story =>
    story.acceptanceCriteria.map(criterion => ({ epic: epic.id, feature: feature.id, story: story.id,
      node: story.architectureNode, ...criterion })))));

  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'Duplicate acceptance IDs');
  for (const row of rows) {
    assert.ok(Object.hasOwn(actions, row.when), 'Unsupported website acceptance: ' + row.when);
    assert.equal(row.node, actions[row.when], 'Wrong CALM owner for ' + row.id);
    for (const [field, prefix] of [['epic', 'EPIC'], ['feature', 'FEAT'], ['story', 'STORY'], ['id', 'AC']]) {
      assert.match(row[field], new RegExp('^' + prefix + '-[0-9]+$'));
    }
    assert.deepEqual(Object.keys(row.then), ['visibleTrails']);
    assert.ok(row.then.visibleTrails.length > 0 && row.then.visibleTrails.every(id => ids.has(id)));
  }
  assert.ok(rows.some(row => row.when === 'open-catalog'), 'The catalog needs an acceptance criterion.');
  return rows;
}

function websiteModel(hasFilter) {
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
  const cards = spec.trails.map(trail => [
    '<article data-trail="' + trail.id + '" data-step-free="' + trail.stepFree + '">',
    '<div class="tag">' + escape(trail.terrain) + '</div>',
    '<h2>' + escape(trail.name) + '</h2><p>' + escape(trail.description) + '</p>',
    '<footer>' + escape(trail.distance) + (trail.stepFree ? ' · Step-free' : ' · Uneven terrain') + '</footer>',
    '</article>',
  ].join('')).join('\n');
  const filter = hasFilter ? '<label><input id="step-free" type="checkbox"> Step-free only</label>' : '';
  const script = hasFilter ? [
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
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Trail Desk</title>',
    '<style>',
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
    '</style></head><body>',
    '<header><span class="eyebrow">The field guide</span><h1>Trail Desk</h1><p>Pick a route before you head out. Compare distance, terrain, and access on three fictional trails.</p></header>',
    '<main><div class="toolbar"><strong id="count" aria-live="polite">' + spec.trails.length + ' trails</strong>' + filter + '</div>',
    '<section class="grid" aria-label="Trail catalog">' + cards + '</section>',
    '<p class="about"><a href="architecture.json">CALM architecture</a> · <a href="architecture.c4">LikeC4 view</a> · <a href="release.json">Release evidence</a></p></main>',
    script, '</body></html>', '',
  ].join('\n');
}

export function buildWebsite(spec) {
  const acceptance = trace(spec);
  const { architecture, view } = websiteModel(acceptance.some(row => row.when === 'filter-step-free'));
  return { architecture, view, html: render(spec, architecture), acceptance };
}

async function verifyWebsite(specFile, output) {
  const approved = await readFile(specFile);
  assert.deepEqual(await readFile(join(output, 'product-requirements.json')), approved, 'Requirements bytes differ');
  const expected = buildWebsite(JSON.parse(approved));
  assert.equal(await readFile(join(output, 'architecture.json'), 'utf8'), json(expected.architecture), 'CALM architecture drift');
  assert.equal(await readFile(join(output, 'architecture.c4'), 'utf8'), expected.view, 'LikeC4 projection drift');
  const { chromium } = await import(pathToFileURL(resolve(process.env.FORGE_PLAYWRIGHT)).href);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
    const observations = [];
    for (const { id, when, then } of expected.acceptance) {
      const filter = page.getByRole('checkbox', { name: 'Step-free only' });
      if (when === 'filter-step-free') await filter.check();
      if (when === 'clear-filter') {
        await filter.check();
        await filter.uncheck();
      }
      const visible = await page.locator('[data-trail]:visible').evaluateAll(elements => elements.map(node => node.dataset.trail));
      assert.deepEqual(visible, then.visibleTrails, id + ' browser acceptance failed');
      observations.push({ id, visible });
    }
    await writeFile(join(output, 'requirements-verification.json'), json({
      requirementsSha256: digest(approved),
      architectureSha256: digest(await readFile(join(output, 'architecture.json'))),
      siteSha256: digest(await readFile(join(output, 'index.html'))),
      acceptance: observations.map(item => item.id),
    }));
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
      for (const name of inputs) assert.equal(digest(await fetchBytes(name)), expected.files[name], name + ' digest mismatch');
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
    const { html, architecture, view } = buildWebsite(JSON.parse(raw));
    await mkdir(second);
    await Promise.all([
      writeFile(join(second, 'product-requirements.json'), raw),
      writeFile(join(second, 'index.html'), html),
      writeFile(join(second, 'architecture.json'), json(architecture)),
      writeFile(join(second, 'architecture.c4'), view),
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
