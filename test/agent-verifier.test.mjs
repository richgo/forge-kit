import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as verifier from '../factory/agent-verifier.mjs';

const product = {
  id: 'sample', runtime: 'node', entry: 'src/main.mjs', files: ['src/main.mjs'],
};
const cases = [{ id: 'AC-1', story: 'STORY-1', input: { miles: 4 }, expected: { kilometres: 6.4 } }];
const initial = { 'src/main.mjs': 'export const multiplier = 1.6;' };
const next = { 'src/main.mjs': 'export const multiplier = 8 / 5;' };

test('the trusted verifier checks actual JSON and holds back expectations', async () => {
  const evidence = await verifier.verifyCandidate(product, cases, initial, async request => {
    assert.deepEqual(request, { runtime: 'node', entry: product.entry, candidate: initial, input: { miles: 4 } });
    return '{"kilometres":6.4}';
  });
  assert.equal(evidence.passed, true);
  assert.equal(evidence.checks[0].id, 'AC-1');
  assert.equal(evidence.checks[0].story, 'STORY-1');
});

test('mismatches, malformed output and failed processes cannot pass acceptance', async () => {
  for (const [run, reason] of [
    [async () => '{"kilometres":4,"passed":true}', 'unexpected-output'],
    [async () => 'I passed.', 'invalid-output'],
    [async () => { throw new Error('candidate-controlled error'); }, 'execution-failed'],
  ]) {
    const evidence = await verifier.verifyCandidate(product, cases, initial, run);
    assert.deepEqual(evidence, { passed: false, checks: [{ id: 'AC-1', story: 'STORY-1', passed: false, reason }] });
  }
});

test('unsafe paths and undeclared source cannot enter the execution workspace', async () => {
  for (const [spec, source] of [
    [product, { ...initial, '.github/workflows/injected.yml': 'bad' }],
    [{ ...product, entry: 'src/../host.mjs', files: ['src/../host.mjs'] }, { 'src/../host.mjs': 'bad' }],
    [{ ...product, entry: 'src/con.mjs', files: ['src/con.mjs'] }, { 'src/con.mjs': 'bad' }],
    [product, { 'src/main.mjs': { injected: true } }],
  ]) {
    let invoked = false;
    await assert.rejects(verifier.verifyCandidate(spec, cases, source, async () => {
      invoked = true;
      return '{}';
    }), /source|path/i);
    assert.equal(invoked, false);
  }
});

test('a recovery drill executes both versions, detects an injected fault and restores the latest verified release', async () => {
  const observed = [];
  const evidence = await verifier.exerciseRecovery({
    initial: { product, cases, candidate: initial }, next: { product, cases, candidate: next },
  }, async ({ candidate }) => {
    const source = candidate['src/main.mjs'];
    observed.push(source);
    return [initial['src/main.mjs'], next['src/main.mjs']].includes(source)
      ? '{"kilometres":6.4}' : 'fault injected';
  });
  assert.equal(evidence.passed, true);
  assert.deepEqual(evidence.events.map(({ phase, passed }) => [phase, passed]), [
    ['verify-initial', true], ['observe-initial', true], ['verify-next', true],
    ['observe-next', true], ['observe-injected', false], ['observe-restored', true],
  ]);
  assert.notEqual(evidence.events[2].release, evidence.events[4].release);
  assert.equal(evidence.events[2].release, evidence.events[5].release);
  assert.equal(evidence.restoredRelease, evidence.events[2].release);
  assert.equal(observed.at(-1), next['src/main.mjs']);
});

test('recovery fails closed if the independently re-observed previous release stays unhealthy', async () => {
  let invocations = 0;
  await assert.rejects(verifier.exerciseRecovery({
    initial: { product, cases, candidate: initial }, next: { product, cases, candidate: next },
  }, async () => {
    invocations++;
    if (invocations === 5) return 'fault injected';
    return invocations <= 4 ? '{"kilometres":6.4}' : '{"kilometres":0}';
  }), /observe-restored/);
});

test('a sandbox execution failure cannot qualify as observing the injected application fault', async () => {
  let invocations = 0;
  await assert.rejects(verifier.exerciseRecovery({
    initial: { product, cases, candidate: initial }, next: { product, cases, candidate: next },
  }, async () => {
    if (++invocations === 5) throw new Error('sandbox unavailable');
    return '{"kilometres":6.4}';
  }), /observe-injected/);
});

if (process.env.FORGE_TEST_CONTAINER === '1') {
  test('the actual container keeps host environment, network, and source writes out of reach', async () => {
    const previous = process.env.FORGE_TEST_HOST_CANARY;
    process.env.FORGE_TEST_HOST_CANARY = 'sentinel';
    const source = {
      'src/main.mjs': [
        "import { readFileSync, writeFileSync } from 'node:fs';",
        "import { networkInterfaces } from 'node:os';",
        "const input = JSON.parse(readFileSync(0, 'utf8'));",
        "let sourceWritable = true;",
        "try { writeFileSync('/work/src/main.mjs', 'tampered'); } catch { sourceWritable = false; }",
        "console.log(JSON.stringify({ input, sourceWritable, hostEnv: process.env.FORGE_TEST_HOST_CANARY ?? null,",
        "  root: process.getuid() === 0, externalNetwork: Object.values(networkInterfaces()).flat().some(i => !i.internal) }));",
      ].join('\n'),
    };
    try {
      const result = await verifier.verifyCandidate(product, [{
        id: 'AC-1', story: 'STORY-1', input: 'isolated',
        expected: { input: 'isolated', sourceWritable: false, hostEnv: null, root: false, externalNetwork: false },
      }], source);
      assert.deepEqual(result, { passed: true, checks: [{ id: 'AC-1', story: 'STORY-1', passed: true }] });
    } finally {
      if (previous === undefined) delete process.env.FORGE_TEST_HOST_CANARY;
      else process.env.FORGE_TEST_HOST_CANARY = previous;
    }
  });
}
