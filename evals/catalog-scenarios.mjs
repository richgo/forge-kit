import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

assert.ok(process.env.FORGE_CATALOG_DIR, 'Supply the pinned catalog checkout in FORGE_CATALOG_DIR');
const catalog = resolve(process.env.FORGE_CATALOG_DIR);
const catalogFile = path => pathToFileURL(join(catalog, path));
const { createEnvironment } = await import(catalogFile('packages/delivery/runtime/delivery.mjs'));
const { runLifecycle } = await import(catalogFile('packages/factory-workflows/runtime/lifecycle.mjs'));
const [requirements, architecture, view] = await Promise.all(
  ['requirements.json', 'architecture.json', 'architecture.c4'].map(
    name => readFile(catalogFile('examples/reference/' + name))
  )
);
const inputs = { requirements, architecture, view };

test('actual deployment byte corruption restores the last good release and escalates', async t => {
  const root = await mkdtemp(join(tmpdir(), 'forge-catalog-eval-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const environment = createEnvironment(root);
  // This separately approved fixture represents an already-active prior release.
  const prior = await environment.promote(Buffer.from('{"path":"/ready","status":200,"body":"prior"}'), () => true);
  const stages = [];
  await assert.rejects(runLifecycle(inputs, environment, {
    maxRepairs: 0,
    onStage: stage => stages.push(stage),
    async probe(env) {
      const revision = await env.active();
      await writeFile(join(root, revision + '.json'), '{"path":"/ready","status":503,"body":"corrupt"}');
      return env.observe();
    },
  }), /rolled back and escalated/);
  assert.deepEqual(stages.slice(-3), ['observe', 'rollback', 'escalated']);
  assert.deepEqual(await environment.observe(), { id: prior.id, status: 200, body: 'prior' });
});
