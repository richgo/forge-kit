import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideRecovery } from '../factory/recovery.mjs';

const baseline = {
  release: 'a'.repeat(64), indexSha256: 'b'.repeat(64), source: 'c'.repeat(40),
  authenticated: true, observedHealthy: true,
};
const candidate = { release: 'd'.repeat(64), source: 'e'.repeat(40) };
const incident = {
  status: 'escalate', reason: 'failure-threshold',
  observations: [
    { attempt: 1, status: 'unhealthy', release: candidate.release },
    { attempt: 2, status: 'unhealthy', release: candidate.release },
  ],
};
const limits = { restorations: 1, attempted: 0 };
const input = () => ({ baseline: { ...baseline }, candidate: { ...candidate },
  incident: structuredClone(incident), limits: { ...limits } });

test('only independently authenticated healthy baseline authorizes restoration request', () => {
  assert.deepEqual(decideRecovery(input()), {
    action: 'request-authenticated-restoration', reason: 'unhealthy-candidate',
    baseline: { release: baseline.release, indexSha256: baseline.indexSha256, source: baseline.source },
    candidate, attempt: 1,
  });
});

test('restoration budget exhaustion escalates instead of looping', () => {
  assert.deepEqual(decideRecovery({ ...input(), limits: { restorations: 1, attempted: 1 } }),
    { action: 'escalate', reason: 'restoration-budget-exhausted' });
});

test('unverified or unhealthy baseline cannot authorize restoration', () => {
  for (const patch of [{ authenticated: false }, { observedHealthy: false }]) {
    assert.deepEqual(decideRecovery({ ...input(), baseline: { ...baseline, ...patch } }),
      { action: 'escalate', reason: 'baseline-not-verified' });
  }
});

test('restoring the already unhealthy baseline is forbidden', () => {
  assert.deepEqual(decideRecovery({ ...input(), candidate: { ...candidate, release: baseline.release } }),
    { action: 'escalate', reason: 'baseline-is-unhealthy' });
});

test('missing, malformed or resolved incident evidence fails closed', () => {
  for (const patch of [
    { status: 'healthy' }, { observations: [] }, { reason: 'arbitrary' },
    { observations: [{ attempt: 2, status: 'unhealthy', release: candidate.release }] },
    { observations: [{ attempt: 1, status: 'healthy', release: candidate.release }] },
    { observations: [{ attempt: 1, status: 'unhealthy', release: baseline.release }] },
  ]) assert.throws(() => decideRecovery({ ...input(), incident: { ...incident, ...patch } }));
});

test('invalid identity or budgets cannot authorize restoration', () => {
  for (const changes of [
    { baseline: { ...baseline, source: 'main' } },
    { baseline: { ...baseline, indexSha256: 'wrong' } },
    { candidate: { ...candidate, release: 'latest' } },
    { limits: { restorations: -1, attempted: 0 } },
    { limits: { restorations: 1, attempted: 2 } },
  ]) assert.throws(() => decideRecovery({ ...input(), ...changes }));
});
