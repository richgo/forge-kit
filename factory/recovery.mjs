import assert from 'node:assert/strict';

// Recovery authorization is deliberately independent of the observer. It may
// authorize a separate trusted deployment workflow, but never deploys bytes.
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function decideRecovery({ incident, baseline, candidate, limits }) {
  assert.ok(incident && incident.status === 'escalate', 'A verified escalation is required');
  assert.ok(Array.isArray(incident.observations) && incident.observations.length > 0,
    'Incident observations are required');
  assert.ok(baseline && digest(baseline.release) && digest(baseline.indexSha256) && commit(baseline.source),
    'Trusted baseline identity required');
  assert.ok(candidate && digest(candidate.release) && commit(candidate.source),
    'Candidate release identity required');
  assert.ok(limits && Number.isSafeInteger(limits.restorations) && limits.restorations >= 0,
    'Restoration budget required');
  assert.ok(Number.isSafeInteger(limits.attempted) && limits.attempted >= 0,
    'Attempt count required');
  assert.ok(limits.attempted <= limits.restorations, 'Attempt count exceeds budget');
  const observations = incident.observations;
  const last = observations.at(-1);
  assert.ok(observations.every((o, i) =>
    o && o.attempt === i + 1 && ['healthy', 'unhealthy'].includes(o.status) &&
    o.release === candidate.release), 'Incident evidence is inconsistent');
  assert.equal(last.status, 'unhealthy', 'Recovery requires an unresolved incident');
  assert.ok(incident.reason === 'failure-threshold' || incident.reason === 'check-budget-exhausted',
    'Unsupported incident reason');
  if (candidate.release === baseline.release) {
    return { action: 'escalate', reason: 'baseline-is-unhealthy' };
  }
  if (limits.attempted >= limits.restorations) {
    return { action: 'escalate', reason: 'restoration-budget-exhausted' };
  }
  if (baseline.authenticated !== true || baseline.observedHealthy !== true) {
    return { action: 'escalate', reason: 'baseline-not-verified' };
  }
  return {
    action: 'request-authenticated-restoration',
    reason: 'unhealthy-candidate',
    baseline: { release: baseline.release, indexSha256: baseline.indexSha256, source: baseline.source },
    candidate: { release: candidate.release, source: candidate.source },
    attempt: limits.attempted + 1,
  };
}
