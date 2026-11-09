import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const bash = process.env.FORGE_TEST_BASH ?? 'bash';
const shellReady = spawnSync(bash, ['-c', 'command -v jq'], { stdio: 'ignore' }).status === 0;
const script = fileURLToPath(new URL('../factory/runtime-incident.sh', import.meta.url));

function journal(t) {
  const directory = mkdtempSync(join(tmpdir(), 'forge-runtime-ledger-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (name, body) => writeFileSync(join(directory, name), body, { mode: 0o755 });
  write('issues.json', '[]');
  write('comments.json', '[]');
  // Fake GitHub transport only. The worker runs with real Bash and jq.
  write('gh', '#!/usr/bin/env bash\n' + [
    'set -euo pipefail',
    'case "$*" in',
    '  *--paginate*issues/12/comments*) jq -c "[.]" comments.json ;;',
    '  *--paginate*issues\\?*) jq -c "[.]" issues.json ;;',
    '  *issues/12/comments*"--method POST"*)',
    '    jq --arg body "$6" \'. + [{user:{login:"github-actions[bot]"},body:($body|sub("^body=";""))}]\' comments.json > next.json',
    '    mv next.json comments.json ;;',
    '  *issues*"--method POST"*)',
    '    jq --arg title "$6" --arg body "$8" \'. + [{number:12,user:{login:"github-actions[bot]"},title:($title|sub("^title=";"")),body:($body|sub("^body=";""))}]\' issues.json > next.json',
    '    mv next.json issues.json; echo 12 ;;',
    '  *) exit 2 ;;',
    'esac',
  ].join('\n') + '\n');
  const env = { ...process.env, PATH: directory + delimiter + process.env.PATH,
    GITHUB_REPOSITORY: 'richgo/forge-kit', GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_RUN_ID: '42', CANDIDATE_RUN: '125', ISSUE: '12', GITHUB_OUTPUT: 'output' };
  return {
    run: (command, vars = {}) => {
      write('output', '');
      execFileSync(bash, [script, command], { cwd: directory, env: { ...env, ...vars }, stdio: 'pipe' });
      return readFileSync(join(directory, 'output'), 'utf8').replaceAll('\r', '');
    },
    read: name => JSON.parse(readFileSync(join(directory, name), 'utf8')),
    write,
  };
}

test('repeated detections retain the same incident after an operator renames it', { skip: !shellReady }, t => {
  const ledger = journal(t);
  ledger.write('issues.json', JSON.stringify([
    { number: 1, user: { login: 'reader' }, title: 'ForgeKit Pages incident for release run 125' },
  ]));
  assert.equal(ledger.run('open'), 'issue=12\n');
  const issues = ledger.read('issues.json');
  issues[1].title = 'Investigating Pages';
  ledger.write('issues.json', JSON.stringify(issues));
  assert.equal(ledger.run('open', { GITHUB_RUN_ID: '43' }), 'issue=12\n');
  assert.equal(ledger.read('issues.json').length, 2);
});

test('a claim consumes the budget across runner retries before a deployment result exists', { skip: !shellReady }, t => {
  const ledger = journal(t);
  ledger.write('comments.json', JSON.stringify([
    { user: { login: 'reader' }, body: '<!-- forgekit: restoration-attempt-1 for run 125 -->' },
  ]));
  assert.equal(ledger.run('budget'), 'attempted=0\n');
  ledger.run('claim');
  assert.equal(ledger.run('budget', { GITHUB_RUN_ID: '43' }), 'attempted=1\n');
  assert.throws(() => ledger.run('claim', { GITHUB_RUN_ID: '43' }), { status: 1 });
  assert.equal(ledger.read('comments.json').length, 2);
});
