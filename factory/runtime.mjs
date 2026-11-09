import assert from 'node:assert/strict';
import { checkPublished } from './pages.mjs';

export function validateMonitorPolicy(policy) {
  assert.ok(policy && typeof policy === 'object');
  for (const key of ['maxFailures', 'maxChecks']) {
    assert.ok(Number.isSafeInteger(policy[key]) && policy[key] > 0 && policy[key] <= 100,
      key + ' must be an integer between 1 and 100');
  }
  assert.ok(policy.maxFailures <= policy.maxChecks, 'Failure threshold exceeds check budget');
  return Object.freeze({ maxFailures: policy.maxFailures, maxChecks: policy.maxChecks });
}

// This monitor does not deploy or repair: only a separately authenticated release
// workflow may change production bytes. Escalation is a fail-closed signal.
export async function observeRelease({ url, expected, policy, probe = checkPublished, onObservation }) {
  const { maxFailures, maxChecks } = validateMonitorPolicy(policy);
  assert.equal(new URL(url).protocol, 'https:', 'HTTPS observation required');
  assert.ok(expected && typeof expected.release === 'string' && /^[a-f0-9]{64}$/.test(expected.release),
    'Expected release digest required');
  assert.equal(typeof probe, 'function');
  const observations = [];
  let consecutiveFailures = 0;
  for (let attempt = 1; attempt <= maxChecks; attempt++) {
    let observation;
    try {
      await probe(url, expected);
      consecutiveFailures = 0;
      observation = { attempt, status: 'healthy', release: expected.release };
    } catch (error) {
      consecutiveFailures++;
      observation = {
        attempt, status: 'unhealthy', release: expected.release,
        error: String(error?.message ?? error), consecutiveFailures,
      };
    }
    observations.push(observation);
    if (onObservation) await onObservation(observation);
    if (consecutiveFailures >= maxFailures) {
      return { status: 'escalate', reason: 'failure-threshold', observations };
    }
  }
  return {
    status: observations.at(-1).status === 'healthy' ? 'healthy' : 'escalate',
    reason: 'check-budget-exhausted',
    observations,
  };
}
