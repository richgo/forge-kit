import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/forgekit.mjs', import.meta.url));

function checkout(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'forgekit-init-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true, maxRetries: 5 }));
  execFileSync('git', ['init', '-q'], { cwd });
  return { cwd, run: (...args) => spawnSync(process.execPath, [cli, 'init', ...args], { cwd, encoding: 'utf8' }) };
}

test('init installs only the project files and is safe to repeat', t => {
  const { cwd, run } = checkout(t);
  const install = run();
  assert.equal(install.status, 0, install.stderr);
  for (const path of ['product-requirements.md', 'request.md', '.forge/verify-change']) {
    assert.deepEqual(readFileSync(join(cwd, path)), readFileSync(new URL('../blueprint/' + path, import.meta.url)));
  }
  assert.equal(existsSync(join(cwd, '.github')), false);
  assert.match(run().stdout, /already installed/);
});

test('hosted init preserves existing workflows and installs a pinned caller', t => {
  const { cwd, run } = checkout(t);
  mkdirSync(join(cwd, '.github/workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github/workflows/site.yml'), 'existing workflow');
  const install = run('--github-actions');
  assert.equal(install.status, 0, install.stderr);
  assert.equal(readFileSync(join(cwd, '.github/workflows/site.yml'), 'utf8'), 'existing workflow');
  const caller = readFileSync(join(cwd, '.github/workflows/forgekit.yml'), 'utf8');
  assert.match(caller, /uses: richgo\/forge-kit\/.github\/workflows\/apmx-factory\.yml@[0-9a-f]{40}/);
  assert.match(caller, /secrets\.COPILOT_GITHUB_TOKEN/);
});

test('an existing project file blocks initialization before any writes', t => {
  const { cwd, run } = checkout(t);
  writeFileSync(join(cwd, 'request.md'), 'existing request');
  const install = run('--github-actions');
  assert.equal(install.status, 1);
  assert.match(install.stderr, /Review the existing request\.md/);
  assert.equal(readFileSync(join(cwd, 'request.md'), 'utf8'), 'existing request');
  for (const path of ['product-requirements.md', '.forge', '.github']) {
    assert.equal(existsSync(join(cwd, path)), false);
  }
});

test('init reports the exact generated files hidden by Git ignore rules', t => {
  const { cwd, run } = checkout(t);
  const ignores = '.*\n!.gitignore\n';
  writeFileSync(join(cwd, '.gitignore'), ignores);
  const install = run('--github-actions');
  assert.equal(install.status, 0, install.stderr);
  assert.match(install.stdout, /git add -f -- \.forge\/verify-change \.github\/workflows\/forgekit\.yml/);
  assert.equal(readFileSync(join(cwd, '.gitignore'), 'utf8'), ignores);
});
