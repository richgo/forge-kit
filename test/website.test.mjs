import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { buildWebsite } from '../factory/website.mjs';

const execute = promisify(execFile);
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

test('the checker rejects injected HTML before opening a browser', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'trail-desk-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = fileURLToPath(new URL('../factory/website.mjs', import.meta.url));
  const input = fileURLToPath(new URL('../examples/trail-desk/step-free/product-requirements.json', import.meta.url));
  const output = join(dir, 'site');
  await execute(process.execPath, [cli, 'build', input, output]);
  await appendFile(join(output, 'index.html'), '<script>globalThis.injected = true;</script>');
  await assert.rejects(execute(process.execPath, [cli, 'verify', input, output]), /Website HTML differs/);
});
