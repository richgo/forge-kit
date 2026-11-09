import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const bash = process.env.FORGE_TEST_BASH ?? 'bash';
const shellReady = spawnSync(bash, ['-c', 'command -v jq'], { stdio: 'ignore' }).status === 0;
const script = fileURLToPath(new URL('../factory/check-pages-deployment.sh', import.meta.url));
const repository = 'richgo/forge-kit';
const url = 'https://richgo.github.io/forge-kit/';
const source = 'a'.repeat(40);

test('the locked guard requires the candidate to be the current successful Pages publisher', { skip: !shellReady }, t => {
  const cwd = mkdtempSync(join(tmpdir(), 'forge-pages-deployment-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const json = (name, value) => writeFileSync(join(cwd, name), JSON.stringify(value));
  const deployment = id => ({ id, sha: source, ref: 'main', performed_via_github_app: { slug: 'github-actions' } });
  const status = (run, state) => [{
    state, log_url: 'https://github.com/' + repository + '/actions/runs/' + run + '/job/1', environment_url: url,
  }];
  json('manifest.json', { source });
  json('deployments.json', [deployment(3), deployment(2)]);
  json('3.json', status(42, 'in_progress'));
  json('2.json', status(125, 'success'));
  writeFileSync(join(cwd, 'gh'), '#!/usr/bin/env bash\n' + [
    'set -euo pipefail',
    'case "$2" in',
    '  *deployments\\?*) cat deployments.json ;;',
    '  *deployments/3/statuses*) cat 3.json ;;',
    '  *deployments/2/statuses*) cat 2.json ;;',
    '  *actions/runs/126*) cat run.json ;;',
    '  *actions/jobs/1*) cat job.json ;;',
    '  *) exit 2 ;;',
    'esac',
  ].join('\n') + '\n', { mode: 0o755 });
  const env = { ...process.env, PATH: cwd + delimiter + process.env.PATH, GITHUB_REPOSITORY: repository,
    GITHUB_SERVER_URL: 'https://github.com', GITHUB_RUN_ID: '42', CANDIDATE_RUN: '125' };
    const guard = () => {
    const result = spawnSync(bash, [script, url, 'manifest.json'], { cwd, env, encoding: 'utf8' });
    if (result.status !== 0) throw Object.assign(new Error(result.stderr), { status: result.status });
    return JSON.parse(result.stdout);
  };
  assert.equal(guard().state, 'success');
  json('run.json', { path: '.github/workflows/factory-e2e.yml', head_branch: 'main' });
  json('3.json', status(126, 'success'));
  assert.throws(guard, { status: 1 });
  json('3.json', status(126, 'failure'));
  assert.throws(guard, { status: 1 });

  json('run.json', { path: '.github/workflows/runtime-recovery.yml', head_branch: 'main' });
  const steps = [{ name: 'Deploy the authenticated predecessor', conclusion: 'skipped' }];
  json('job.json', { run_id: 126, status: 'completed', steps });
  json('2.json', [...status(125, 'inactive'), ...status(125, 'success')]);
  assert.equal(guard().state, 'success');
  steps[0].conclusion = 'failure';
  json('job.json', { run_id: 126, status: 'completed', steps });
  assert.throws(guard, { status: 1 });
});
