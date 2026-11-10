import assert from 'node:assert/strict';

const phases = ['verify-initial', 'observe-initial', 'verify-next', 'observe-next', 'observe-injected', 'observe-restored'];
export const runtimeLimits = Object.freeze({ healthyProbeP95Ms: 2500, recoveryMs: 30000 });

export function runtimeMetrics(recovery, measurements) {
  assert.equal(recovery.passed, true, 'Successful drill required');
  assert.deepEqual(recovery.events.map(event => event.phase), phases, 'Unexpected recovery sequence');
  assert.deepEqual(recovery.events.map(event => event.passed), [true, true, true, true, false, true]);
  let offset = 0;
  let lastEnd = 0;
  const healthy = [];
  const observations = recovery.events.map(({ phase, checks, passed }) => {
    const samples = measurements.slice(offset, offset + checks.length);
    assert.ok(samples.length && samples.length === checks.length, 'Missing probe evidence');
    offset += samples.length;
    for (const [start, end] of samples) {
      assert.ok(Number.isFinite(end) && start >= lastEnd && end >= start, 'Invalid probe clock');
      if (passed) healthy.push(end - start);
      lastEnd = end;
    }
    return { phase, count: samples.length, elapsedMs: Math.ceil(samples.at(-1)[1] - samples[0][0]), end: lastEnd };
  });
  assert.equal(offset, measurements.length, 'Unexpected probe evidence');
  healthy.sort((a, b) => a - b);
  return { schemaVersion: 1, observations: observations.map(({ end, ...summary }) => summary),
    healthyProbeP95Ms: Math.ceil(healthy[Math.ceil(healthy.length * 0.95) - 1]),
    recoveryMs: Math.ceil(observations[5].end - observations[4].end) };
}
