import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const version = '2.0.0';
const installedTool = fileURLToPath(new URL(
  '../toolchain/openspec/node_modules/@fission-ai/openspec/bin/openspec.js', import.meta.url,
));

async function approvedFile(root, path, optional = false) {
  const segments = path.split('/');
  const last = segments.pop();
  let directory = root;
  for (const segment of segments) {
    directory = join(directory, segment);
    const info = await lstat(directory).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!info && optional) return null;
    assert.ok(info?.isDirectory(), 'Missing approved file or irregular directory in ' + path);
  }
  const file = join(directory, last);
  const info = await lstat(file).catch(error => {
    if (error.code === 'ENOENT') {
      if (optional) return null;
      throw new Error('Missing approved file ' + path, { cause: error });
    }
    throw error;
  });
  if (!info) return null;
  assert.ok(info.isFile() && info.size > 0 && info.size <= 1024 * 1024, 'Invalid approved file ' + path);
  return readFile(file);
}

export async function validateOpenSpec(workspace, { optional = false, tool = installedTool } = {}) {
  const root = resolve(workspace);
  const bindingPath = '.forge/openspec.json';
  const binding = await approvedFile(root, bindingPath, optional);
  if (!binding) return { status: 'skipped' };
  const { schema, change, acceptance } = JSON.parse(binding);
  assert.equal(schema, 1, 'Unsupported OpenSpec binding schema');
  assert.match(change ?? '', /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Invalid OpenSpec change slug');
  assert.ok(acceptance && typeof acceptance === 'object' && !Array.isArray(acceptance) &&
    Object.keys(acceptance).length, 'OpenSpec acceptance bindings are required');
  const base = 'openspec/changes/' + change;
  const files = new Map([[bindingPath, binding]]);
  for (const [id, entry] of Object.entries(acceptance)) {
    assert.match(id, /^AC-[A-Z0-9][A-Z0-9-]*$/, 'Invalid acceptance ID');
    const { spec, scenario } = entry ?? {};
    assert.ok(typeof spec === 'string' && spec.startsWith(base + '/') &&
      /^specs\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/spec\.md$/.test(spec.slice(base.length + 1)), 'Invalid spec path');
    assert.ok(typeof scenario === 'string' && scenario.trim() === scenario && scenario.length &&
      !/[\r\n]/.test(scenario), 'Invalid scenario title');
    if (!files.has(spec)) files.set(spec, await approvedFile(root, spec));
    const headings = files.get(spec).toString('utf8').split(/\r?\n/)
      .filter(line => line.trimEnd() === '#### Scenario: ' + scenario);
    assert.equal(headings.length, 1, 'Expected one OpenSpec scenario for ' + id);
  }
  for (const artifact of ['proposal.md', 'design.md', 'tasks.md']) {
    const path = base + '/' + artifact;
    files.set(path, await approvedFile(root, path));
  }
  const options = { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, OPENSPEC_TELEMETRY: '0' } };
  const run = args => exec(process.execPath, [resolve(tool), ...args], options);
  const installed = await run(['--version']).catch(error => {
    throw new Error('Could not run the pinned OpenSpec CLI. Install toolchain/openspec or pass --tool.', { cause: error });
  });
  assert.equal(installed.stdout.trim(), version, 'Unsupported OpenSpec CLI version');
  try {
    await run(['validate', change, '--type', 'change', '--strict', '--no-interactive', '--json']);
  } catch (error) {
    throw new Error('OpenSpec validation failed for ' + change + '\n' + (error.stdout || error.stderr || error.message),
      { cause: error });
  }
  const sha256 = Object.fromEntries([...files.keys()].sort().map(path =>
    [path, createHash('sha256').update(files.get(path)).digest('hex')]));
  return { schema: 1, status: 'valid', version, change, sha256 };
}
