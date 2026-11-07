import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run, validateArchitecture, verifyRun } from '../factory/slice.mjs';
import { assemble, routeRepair } from '../factory/integrations.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));

async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'forge-kit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'run');
}

test('runs all stages and binds the deployed bytes to independent evidence', async t => {
  const output = await workspace(t);
  const receipt = await run(output);
  assert.deepEqual(receipt.predicate.stages, [
    'requirements', 'architecture', 'plan', 'build', 'test',
    'deploy', 'observe', 'evidence', 'review-ready'
  ]);
  assert.equal(receipt._type, 'https://in-toto.io/Statement/v1');
  assert.equal(await verifyRun(output), true);
  await writeFile(join(output, 'deployed.mjs'), 'changed after acceptance');
  await assert.rejects(verifyRun(output), /digest/);
});

test('repairs a rejected build once and escalates when policy gives it no budget', async t => {
  const output = await workspace(t);
  const receipt = await run(output, { faultyFirstBuild: true });
  assert.equal(receipt.predicate.repairs, 1);
  assert.deepEqual(receipt.predicate.stages.slice(3, 8), ['build', 'test', 'repair', 'build', 'test']);
  assert.equal(await verifyRun(output), true);
  await assert.rejects(
    run(output + '-blocked', { faultyFirstBuild: true, maxRepairs: 0 }),
    /repair denied/
  );
  await assert.rejects(readFile(join(output + '-blocked', 'receipt.json')), { code: 'ENOENT' });
});

test('rejects a CALM requirement target absent from the model and a drifting view', async () => {
  const calm = await json('architecture/slice.json');
  const requirements = await json('examples/requirements.json');
  const view = await readFile('architecture/slice.c4', 'utf8');
  assert.doesNotThrow(() => validateArchitecture(calm, requirements, view));
  assert.throws(() => validateArchitecture(calm, { ...requirements, node: 'missing' }, view), /target/);
  assert.throws(() => validateArchitecture(calm, requirements, view + 'model {}'), /view/);
});

test('a typed repair signal cannot exceed policy or authorize an unknown route', () => {
  const recommendation = { choice: 'retry-build', probability: 0.95 };
  assert.equal(routeRepair(recommendation, { used: 0, limit: 1 }), 'retry-build');
  assert.equal(routeRepair(recommendation, { used: 1, limit: 1 }), 'escalate');
  assert.equal(routeRepair({ ...recommendation, choice: 'deploy' }, { used: 0, limit: 1 }), 'escalate');
  assert.equal(routeRepair({ ...recommendation, probability: 1.2 }, { used: 0, limit: 1 }), 'escalate');
  assert.equal(routeRepair(null, { used: 0, limit: 1 }), 'escalate');
});

test('assembly reports unresolved capabilities and refuses mutable package references', async () => {
  const manifest = await json('factory/packages.json');
  assert.deepEqual(assemble(manifest).pending, ['orchestration', 'execution', 'checking', 'skills', 'mcp']);
  assert.match(assemble(manifest).rehearsal, /^danielmeppiel\/apmx\/.+#[a-f0-9]{40}$/);
  manifest.rehearsal.ref += '\n';
  assert.throws(() => assemble(manifest), /commit SHA/);
  manifest.rehearsal.ref = 'main';
  assert.throws(() => assemble(manifest), /commit SHA/);
});
