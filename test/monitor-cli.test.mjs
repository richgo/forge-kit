import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { expectedFromEnvironment, runMonitor } from '../factory/monitor-cli.mjs';

const env = {
  FORGE_PAGES_URL: 'https://example.test/forge-kit/',
  FORGE_EXPECTED_RELEASE: 'a'.repeat(64),
  FORGE_EXPECTED_INDEX_SHA256: 'b'.repeat(64),
  FORGE_EXPECTED_SOURCE: 'c'.repeat(40),
};

test('scheduled monitor refuses missing or invalid trusted release inputs', () => {
  for (const key of Object.keys(env)) {
    assert.throws(() => expectedFromEnvironment({ ...env, [key]: '' }));
  }
  assert.deepEqual(expectedFromEnvironment(env).expected, {
    source: env.FORGE_EXPECTED_SOURCE, release: env.FORGE_EXPECTED_RELEASE,
    indexSha256: env.FORGE_EXPECTED_INDEX_SHA256,
  });
});

test('scheduled monitor persists exact release identity and observations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'forge-monitor-'));
  try {
    const output = join(dir, 'observations.json');
    const result = await runMonitor({ ...env, FORGE_MONITOR_OUTPUT: output }, {
      observeRelease: async ({ url, expected, policy, onObservation }) => {
        assert.equal(url, env.FORGE_PAGES_URL);
        assert.equal(expected.release, env.FORGE_EXPECTED_RELEASE);
        assert.deepEqual(policy, { maxFailures: 2, maxChecks: 3 });
        await onObservation({ attempt: 1, status: 'healthy', release: expected.release });
        return { status: 'healthy', observations: [] };
      },
    });
    assert.equal(result.status, 'healthy');
    const saved = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(saved.observations.length, 1);
    assert.match(saved.observations[0].at, /^\d{4}-\d\d-\d\dT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('scheduled monitor fails the job on escalation while preserving incident evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'forge-monitor-'));
  try {
    const output = join(dir, 'incident.json');
    await assert.rejects(runMonitor({ ...env, FORGE_MONITOR_OUTPUT: output }, {
      observeRelease: async ({ onObservation }) => {
        await onObservation({ attempt: 1, status: 'unhealthy', error: 'digest mismatch' });
        return { status: 'escalate', reason: 'failure-threshold', observations: [] };
      },
    }), /escalated/);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).status, 'escalate');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('scheduled workflow is read-only and never contains deploy or write permissions', async () => {
  const workflow = await readFile(new URL('../.github/workflows/runtime-observation.yml', import.meta.url), 'utf8');
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: '17 \*\/3 \* \* \*'/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /pages: write|id-token: write|actions: write|deploy-pages/);
  assert.match(workflow, /if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /node factory\/monitor-cli\.mjs/);
});
