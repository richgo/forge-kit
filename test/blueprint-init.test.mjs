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

test('init exposes the generated files while preserving ignored siblings', t => {
  const { cwd, run } = checkout(t);
  const ignores = '.*\n!.gitignore\n';
  writeFileSync(join(cwd, '.gitignore'), ignores);
  mkdirSync(join(cwd, '.github/workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github/workflows', 'site.yml'), 'ignored workflow');
  const install = run('--github-actions');
  assert.equal(install.status, 0, install.stderr);
  assert.match(install.stdout, /Updated \.gitignore/);
  const after = readFileSync(join(cwd, '.gitignore'), 'utf8');
  assert.ok(after.startsWith(ignores));
  const ignored = path => spawnSync('git', ['check-ignore', '-q', '--', path], { cwd }).status === 0;
  assert.equal(ignored('.forge/verify-change'), false);
  assert.equal(ignored('.github/workflows/forgekit.yml'), false);
  assert.equal(ignored('.github/workflows/site.yml'), true);
  assert.equal(ignored('.forge/private.txt'), true);
  const repeat = run('--github-actions');
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.match(repeat.stdout, /already installed/);
  assert.equal(readFileSync(join(cwd, '.gitignore'), 'utf8'), after);
});

test('init rolls back if a nested ignore rule still blocks a project file', t => {
  const { cwd, run } = checkout(t);
  const ignores = '.*\n!.gitignore\n';
  writeFileSync(join(cwd, '.gitignore'), ignores);
  mkdirSync(join(cwd, '.forge'));
  writeFileSync(join(cwd, '.forge/.gitignore'), 'verify-change\n');
  const install = run('--github-actions');
  assert.equal(install.status, 1, install.stderr);
  assert.match(install.stderr, /still hide .forge\/verify-change/);
  assert.equal(readFileSync(join(cwd, '.gitignore'), 'utf8'), ignores);
  for (const path of ['product-requirements.md', 'request.md', '.forge/verify-change', '.github']) {
    assert.equal(existsSync(join(cwd, path)), false);
  }
});
