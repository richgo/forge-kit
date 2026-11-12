import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadDecisionAdvisor } from '../factory/decision-provider.mjs';

async function providerFile(t, source) {
  const directory = await mkdtemp(join(tmpdir(), 'forgekit-decision-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'provider.mjs');
  await writeFile(path, source);
  return path;
}

test('a configured provider handles repair and runtime without Jev credentials', async t => {
  const path = await providerFile(t, `
    export const recommendRepair = (state, { signal }) => ({
      choice: state.failure === 'readiness-mismatch' && !signal.aborted && !('privateData' in state)
        ? 'retry-build' : 'escalate',
      probability: 0.91,
    });
    export const recommendRuntime = () => ({ choice: 'restore', probability: 0.95 });
  `);
  const advisor = loadDecisionAdvisor({ FORGE_DECISION_PROVIDER_MODULE: path });
  assert.deepEqual(await advisor.recommendRepair({ failure: 'readiness-mismatch', used: 0, limit: 1, privateData: 'test' }),
    { choice: 'retry-build', probability: 0.91 });
  assert.deepEqual(await advisor.recommendRuntime({ failure: 'confirmed-content-mismatch' }),
    { choice: 'restore', probability: 0.95 });
  assert.equal(loadDecisionAdvisor({}), undefined);
});

test('provider errors, invalid results and missed deadlines withhold advice', async t => {
  const path = await providerFile(t, `
    export function recommendRepair(state) {
      if (state.failure === 'unclassified-failure') throw Error('provider unavailable');
      return { choice: 'restore', probability: 1 };
    }
    export const recommendRuntime = () => new Promise(() => {});
  `);
  const advisor = loadDecisionAdvisor({ FORGE_DECISION_PROVIDER_MODULE: path });
  for (const failure of ['unclassified-failure', 'readiness-mismatch']) {
    assert.equal(await advisor.recommendRepair({ failure, used: 0, limit: 1 }), null);
  }
  assert.equal(await advisor.recommendRuntime({ failure: 'unconfirmed' }, { timeoutMs: 10 }), null);
});

test('the default runtime adapter uses the workflow-pinned Jev module', async t => {
  const path = await providerFile(t, `
    export const requestJevRuntime = (token, _fetch, state) =>
      token === 'test-token' && state.failure === 'confirmed-content-mismatch'
        ? { choice: 'restore', probability: 0.95 } : null;
  `);
  const advisor = loadDecisionAdvisor({
    FORGE_JEV_TOKEN: 'test-token',
    FORGE_RUNTIME_ADVISOR: path,
    FORGE_DECISION_PACKAGE: join(tmpdir(), 'missing-repair-package'),
  });
  assert.deepEqual(await advisor.recommendRuntime({ failure: 'confirmed-content-mismatch' }),
    { choice: 'restore', probability: 0.95 });
});
