import assert from 'node:assert/strict';
import { appendFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { observeRelease } from './runtime.mjs';

const hex = (value, length) => typeof value === 'string' && new RegExp('^[a-f0-9]{' + length + '}$').test(value);

export function expectedFromEnvironment(env) {
  assert.ok(hex(env.FORGE_EXPECTED_RELEASE, 64), 'FORGE_EXPECTED_RELEASE must be an immutable 64-character digest');
  assert.ok(hex(env.FORGE_EXPECTED_INDEX_SHA256, 64), 'FORGE_EXPECTED_INDEX_SHA256 must be a 64-character digest');
  assert.ok(hex(env.FORGE_EXPECTED_SOURCE, 40), 'FORGE_EXPECTED_SOURCE must be a 40-character commit');
  assert.ok(typeof env.FORGE_PAGES_URL === 'string' && env.FORGE_PAGES_URL.length > 0, 'FORGE_PAGES_URL required');
  return {
    url: env.FORGE_PAGES_URL,
    expected: {
      source: env.FORGE_EXPECTED_SOURCE,
      release: env.FORGE_EXPECTED_RELEASE,
      indexSha256: env.FORGE_EXPECTED_INDEX_SHA256,
    },
  };
}

export async function runMonitor(env = process.env, options = {}) {
  const { url, expected } = expectedFromEnvironment(env);
  const policy = { maxFailures: 2, maxChecks: 3 };
  const observations = [];
  const monitor = options.observeRelease ?? observeRelease;
  const result = await monitor({
    url, expected, policy,
    onObservation: async observation => { observations.push({ ...observation, at: new Date().toISOString() }); },
  });
  assert.ok(result && ['healthy', 'escalate'].includes(result.status), 'Unknown monitor result');
  const record = {
    schemaVersion: 1, url, expected, policy, status: result.status,
    reason: result.reason, observations,
  };
  if (env.FORGE_MONITOR_OUTPUT) await writeFile(env.FORGE_MONITOR_OUTPUT, JSON.stringify(record, null, 2) + '\n');
  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(env.GITHUB_STEP_SUMMARY,
      '### ForgeKit runtime observation\n\nStatus: **' + result.status + '**; release: `' + expected.release + '`; checks: ' + observations.length + '\n');
  }
  if (result.status !== 'healthy') throw new Error('Runtime observation escalated: ' + (result.reason ?? 'unknown'));
  return record;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runMonitor();
}
