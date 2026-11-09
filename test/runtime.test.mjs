import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeRelease, validateMonitorPolicy } from '../factory/runtime.mjs';

const expected = { release: 'a'.repeat(64) };
const url = 'https://example.test/forge-kit/';

test('monitor observes exact expected release and records successful checks', async () => {
  const calls = [];
  const result = await observeRelease({
    url, expected, policy: { maxFailures: 2, maxChecks: 3 },
    probe: async (actualUrl, actualExpected) => {
      assert.equal(actualUrl, url);
      assert.equal(actualExpected, expected);
      calls.push(actualUrl);
    },
  });
  assert.equal(result.status, 'healthy');
  assert.equal(result.observations.length, 3);
  assert.equal(calls.length, 3);
});

test('monitor escalates after consecutive failures without performing a mutation', async () => {
  let calls = 0;
  const result = await observeRelease({
    url, expected, policy: { maxFailures: 2, maxChecks: 10 },
    probe: async () => { calls++; throw new Error('digest mismatch'); },
  });
  assert.equal(result.status, 'escalate');
  assert.equal(result.reason, 'failure-threshold');
  assert.equal(calls, 2);
  assert.deepEqual(result.observations.map(o => o.consecutiveFailures), [1, 2]);
});

test('successful observation resets consecutive failure count', async () => {
  const outcomes = [false, true, false, true];
  const result = await observeRelease({
    url, expected, policy: { maxFailures: 2, maxChecks: 4 },
    probe: async () => { if (!outcomes.shift()) throw new Error('unhealthy'); },
  });
  assert.equal(result.status, 'healthy');
  assert.deepEqual(result.observations.map(o => o.status),
    ['unhealthy', 'healthy', 'unhealthy', 'healthy']);
});

test('last observation unhealthy escalates at check budget even below threshold', async () => {
  const result = await observeRelease({
    url, expected, policy: { maxFailures: 2, maxChecks: 2 },
    probe: (() => {
      let attempt = 0;
      return async () => { if (++attempt === 2) throw new Error('outage'); };
    })(),
  });
  assert.equal(result.status, 'escalate');
  assert.equal(result.reason, 'check-budget-exhausted');
});

test('monitor validates policy and expected release before contacting a provider', async () => {
  for (const policy of [
    { maxFailures: 0, maxChecks: 2 },
    { maxFailures: 3, maxChecks: 2 },
    { maxFailures: 1.5, maxChecks: 2 },
    { maxFailures: 1, maxChecks: 101 },
  ]) assert.throws(() => validateMonitorPolicy(policy));
  await assert.rejects(observeRelease({
    url: 'http://example.test/', expected, policy: { maxFailures: 1, maxChecks: 1 },
    probe: () => { throw new Error('should not run'); },
  }), /HTTPS/);
  await assert.rejects(observeRelease({
    url, expected: { release: 'mutable' }, policy: { maxFailures: 1, maxChecks: 1 },
  }), /digest/);
});

test('monitor exposes observations to an audit sink; audit failure is not silently ignored', async () => {
  const seen = [];
  await assert.rejects(observeRelease({
    url, expected, policy: { maxFailures: 1, maxChecks: 2 },
    probe: async () => {},
    onObservation: async o => { seen.push(o); throw new Error('audit sink failed'); },
  }), /audit sink failed/);
  assert.equal(seen.length, 1);
});
