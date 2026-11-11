import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

test('native blueprint is independent of the legacy JavaScript factory', async () => {
  const readme = await readFile(new URL('../blueprint/README.md', import.meta.url), 'utf8');
  assert.match(readme, /apmx --from/);
  assert.match(readme, /software-factory#[0-9a-f]{40}/);
  assert.doesNotMatch(readme, /node factory\//);
});

test('unconfigured project verifier rejects candidate patches', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'forge-blueprint-'));
  try {
    await cp(new URL('../blueprint/.forge/verify-change', import.meta.url), join(dir, 'verify-change'));
    const script = join(dir, 'verify-change');
    const run = spawnSync(bash, [script, join(dir, 'missing.diff')], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Missing or symlinked candidate patch/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
