import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requestJevRepair, routeRepair } from '../factory/integrations.mjs';
import { run, verifyRun } from '../factory/slice.mjs';

assert.ok(process.env.FORGE_JEV_TOKEN, 'Configure the FORGE_JEV_TOKEN repository secret');
const root = await mkdtemp(join(tmpdir(), 'forge-jev-'));
try {
  const recommendation = await requestJevRepair(process.env.FORGE_JEV_TOKEN);
  assert.ok(recommendation, 'Jev did not return a valid typed repair recommendation');
  const route = routeRepair(recommendation, { used: 0, limit: 1 });
  assert.equal(routeRepair(recommendation, { used: 1, limit: 1 }), 'escalate');
  const output = join(root, 'run');
  const attempt = run(output, {
    fault: 'wrong-output-once',
    recommendRepair: () => recommendation,
  });
  if (route === 'retry-build') {
    assert.equal((await attempt).predicate.repairs, 1);
    await verifyRun(output);
  } else {
    await assert.rejects(attempt, /repair denied/);
    await assert.rejects(readFile(join(output, 'deployed.mjs')), { code: 'ENOENT' });
  }
  console.log(JSON.stringify({ recommendation, route, exhausted: 'escalate', observed: 'passed' }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
