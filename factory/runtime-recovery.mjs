import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { decideRecovery } from './recovery.mjs';

export const websiteFiles = ['index.html', 'architecture.json', 'architecture.c4'];
const digest = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function observeRuntime(url, expected, send = fetch) {
  assert.match(expected.source, /^[a-f0-9]{40}$/);
  assert.match(expected.release, digest);
  assert.equal(Object.keys(expected.files).length, websiteFiles.length);
  for (const file of websiteFiles) assert.match(expected.files[file], digest);
  const root = new URL(url);
  assert.equal(root.protocol, 'https:');
  assert.equal(root.username + root.password + root.search + root.hash, '');
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  const get = async name => {
    const request = new URL(name, root);
    request.searchParams.set('probe', randomUUID());
    const response = await send(request, {
      headers: { 'Cache-Control': 'no-cache' }, redirect: 'error', signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error('Unavailable Pages content');
    return response;
  };
  try {
    const actual = await (await get('release.json')).json();
    if (!sameManifest(actual, expected)) return 'different';
    const matches = await Promise.all(websiteFiles.map(async name =>
      hash(Buffer.from(await (await get(name)).arrayBuffer())) === expected.files[name]));
    return matches.every(Boolean) ? 'healthy' : 'content-mismatch';
  } catch {
    return 'unavailable';
  }
}

function sameManifest(actual, expected) {
  return actual?.source === expected.source && actual.release === expected.release &&
    Object.keys(actual).length === 3 && actual.files &&
    Object.keys(actual.files).length === websiteFiles.length &&
    websiteFiles.every(name => actual.files[name] === expected.files[name]);
}

// Both manifests come from verified archives. The worker also verifies the
// predecessor's retained successful observation before calling this policy.
export async function planRuntimeRecovery({ url, candidate, baseline, attempted = 0, send = fetch, advise }) {
  const observations = [];
  const check = async () => {
    const result = await observeRuntime(url, candidate, send);
    observations.push({
      attempt: observations.length + 1, release: candidate.release,
      status: result === 'healthy' ? 'healthy' : 'unhealthy', result, at: new Date().toISOString(),
    });
    return result;
  };

  const first = await check();
  if (first === 'healthy') return { action: 'healthy', observations };
  if (first === 'different') {
    const result = await observeRuntime(url, baseline, send);
    if (result === 'healthy') {
      const baselineObservation = { release: baseline.release, result, at: new Date().toISOString() };
      return { action: 'already-restored', observations, baselineObservation };
    }
  }
  const second = await check();
  if (second === 'healthy') return { action: 'healthy', observations };

  const confirmed = first === 'content-mismatch' && second === 'content-mismatch';
  const recommendation = await advise({ failure: confirmed ? 'confirmed-content-mismatch' : 'unconfirmed' });
  const decision = { action: 'escalate', reason: 'advisor-escalated', observations, recommendation };
  if (!(recommendation?.probability >= 0.8 && recommendation.probability <= 1)) return decision;
  if (recommendation.choice === 'retry-observation') {
    if (await check() === 'healthy') return { ...decision, action: 'healthy', reason: 'retry-observed-healthy' };
    return { ...decision, reason: 'retry-did-not-restore-health' };
  }
  if (recommendation.choice !== 'restore' || !confirmed) return decision;
  const authorization = decideRecovery({
    incident: { status: 'escalate', reason: 'failure-threshold', observations },
    baseline: { ...baseline, indexSha256: baseline.files['index.html'], authenticated: true, observedHealthy: true },
    candidate, limits: { attempted, restorations: 1 },
  });
  if (authorization.action !== 'request-authenticated-restoration') {
    return { ...decision, reason: authorization.reason };
  }
  return { ...decision, action: 'restore', reason: authorization.reason, authorization };
}
