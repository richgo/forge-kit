import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { buildWebsite } from '../factory/website.mjs';

const spec = async release => JSON.parse(await readFile(new URL(
  '../examples/trail-desk/' + release + '/product-requirements.json', import.meta.url)));

test('the feature change generates a browser component and ships a filter', async () => {
  const baseline = buildWebsite(await spec('baseline'));
  const change = buildWebsite(await spec('step-free'));
  assert.deepEqual(baseline.architecture.nodes.map(node => node['unique-id']),
    ['visitor', 'browser', 'pages', 'trail_catalog']);
  assert.equal(change.architecture.nodes.at(-1)['unique-id'], 'step_free_filter');
  assert.match(change.view, /browser -> step_free_filter/);
  assert.doesNotMatch(baseline.html, /<script>|Step-free only/);
  assert.match(change.html, /<script>|Step-free only/);
  assert.match(baseline.html, /Fern Loop/);
  assert.match(change.html, /Fern Loop/);
});

test('unsupported acceptance actions stop architecture generation', async () => {
  const input = await spec('baseline');
  input.epics[0].features[0].stories[0].acceptanceCriteria[0].when = 'invent-feature';
  assert.throws(() => buildWebsite(input), /Unsupported website acceptance/);
});
