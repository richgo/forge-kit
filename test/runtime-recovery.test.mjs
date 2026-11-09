import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import * as worker from '../factory/runtime-recovery.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function release(source, name) {
  const files = { 'index.html': name, 'architecture.json': '{}', 'architecture.c4': 'model {}' };
  return {
    files,
    manifest: { source: source.repeat(40), release: hash(name),
      files: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, hash(value)])) },
  };
}
const candidate = release('a', 'candidate');
const baseline = release('b', 'baseline');

function fixture() {
  let active = candidate;
  let broken = true;
  let requests = 0;
  const context = {
    url: 'https://pages.example/product/',
    candidate: candidate.manifest,
    baseline: baseline.manifest,
    send: async url => {
      requests++;
      const name = new URL(url).pathname.split('/').pop();
      return name === 'release.json' ? Response.json(active.manifest) :
        new Response(name === 'index.html' && broken ? 'injected corrupt bytes' : active.files[name]);
    },
    advise: async () => ({ choice: 'restore', probability: 0.95 }),
  };
  return { context, get requests() { return requests; },
    restore: () => { active = baseline; broken = false; }, heal: () => { broken = false; },
    supersede: () => { active = release('c', 'new release'); broken = false; } };
}

test('corrupt candidate authorizes only its authenticated predecessor and restored bytes are re-observed', async () => {
  const system = fixture();
  const result = await worker.planRuntimeRecovery(system.context);
  assert.equal(result.action, 'restore');
  assert.equal(result.authorization.baseline.release, baseline.manifest.release);
  assert.equal(result.observations.length, 2);
  assert.equal(await worker.observeRuntime(system.context.url, baseline.manifest, system.context.send), 'different');
  system.restore();
  assert.equal(await worker.observeRuntime(system.context.url, baseline.manifest, system.context.send), 'healthy');
  assert.equal((await worker.planRuntimeRecovery(system.context)).action, 'already-restored');
});

test('an unrecognized deployment is never overwritten even with a restore recommendation', async () => {
  const system = fixture();
  system.supersede();
  assert.equal((await worker.planRuntimeRecovery(system.context)).action, 'escalate');
});

test('an unavailable manifest cannot authorize restoring a stale candidate', async () => {
  const { context } = fixture();
  assert.equal((await worker.planRuntimeRecovery({ ...context, send: () => new Response('', { status: 503 }) })).action,
    'escalate');
});

test('Jev retry adds at most one observation and avoids a restore when service heals', async () => {
  const system = fixture();
  system.context.advise = async () => {
    system.heal();
    return { choice: 'retry-observation', probability: 0.95 };
  };
  const result = await worker.planRuntimeRecovery(system.context);
  assert.equal(result.action, 'healthy');
  assert.equal(result.observations.length, 3);
});

test('a prior claim or weak recommendation prevents restoration', async () => {
  const { context } = fixture();
  assert.equal((await worker.planRuntimeRecovery({ ...context, attempted: 1 })).action, 'escalate');
  assert.equal((await worker.planRuntimeRecovery({ ...context,
    advise: async () => ({ choice: 'restore', probability: 0.7 }) })).action, 'escalate');
});

test('the verification probe checks architecture bytes alongside HTML', async () => {
  const { context } = fixture();
  assert.equal(await worker.observeRuntime(context.url, baseline.manifest, url =>
    new URL(url).pathname.endsWith('/release.json') ? Response.json(baseline.manifest) :
      new Response(new URL(url).pathname.endsWith('/architecture.c4') ? 'tampered' :
        baseline.files[new URL(url).pathname.split('/').pop()])), 'content-mismatch');
});
