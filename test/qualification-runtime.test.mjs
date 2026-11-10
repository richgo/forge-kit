import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeMetrics } from '../factory/qualification-runtime.mjs';

test('runtime metrics isolate the failure-to-healthy interval and exclude the fault from p95', () => {
  const events = ['verify-initial', 'observe-initial', 'verify-next', 'observe-next',
    'observe-injected', 'observe-restored'].map((phase, index) => ({ phase, passed: index !== 4, checks: [{}] }));
  const measurements = [[1, 3], [4, 7], [8, 12], [13, 18], [19, 48], [52, 60]];
  const result = runtimeMetrics({ passed: true, events }, measurements);
  assert.equal(result.recoveryMs, 12);
  assert.equal(result.healthyProbeP95Ms, 8);
  assert.throws(() => runtimeMetrics({ passed: true, events }, measurements.slice(1)), /probe evidence/);
});
