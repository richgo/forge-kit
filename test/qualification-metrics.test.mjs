import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateRuntime, jobTimeline } from '../factory/qualification-metrics.mjs';

test('job time is separate from elapsed time and includes earlier attempts', () => {
  const start = '2026-11-10T00:00:00Z';
  const entry = (name, seconds, elapsed, conclusion) => ({ name, conclusion,
    started_at: new Date(Date.parse(start) + seconds * 1000).toISOString(),
    completed_at: new Date(Date.parse(start) + (seconds + elapsed) * 1000).toISOString() });
  const jobs = [entry('author (x, node)', 5, 10, 'failure'), entry('author (x, node)', 30, 5, 'success'),
    entry('release (x, node)', 45, 10, 'success')];
  const result = jobTimeline({ created_at: start }, jobs, 'x', 'node', 'release');
  assert.equal(result.runnerSeconds, 25);
  assert.equal(result.leadSeconds, 55);
  assert.equal(result.failedJobs, 1);
  assert.throws(() => jobTimeline({ created_at: start }, jobs.slice(0, 2), 'x', 'node', 'release'), /release job/);
});

test('missing telemetry fails closed and valid over-budget evidence is reported as a breach', () => {
  assert.deepEqual(gateRuntime({ healthyProbeP95Ms: 25, recoveryMs: 6000 }), []);
  assert.deepEqual(gateRuntime({ healthyProbeP95Ms: 2501, recoveryMs: 30001 }).map(x => x.metric),
    ['healthyProbeP95Ms', 'recoveryMs']);
  assert.throws(() => gateRuntime({ healthyProbeP95Ms: 0 }), /Missing runtime measurement/);
});
