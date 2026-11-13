import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { validateOpenSpec } from '../bin/openspec.mjs';

const { PRODUCT_PLAN, PRODUCT_UNIT, TARGET_WORKSPACE } = process.env;

try {
  const plan = JSON.parse(await readFile(PRODUCT_PLAN));
  const unit = plan.units[PRODUCT_UNIT];
  const target = await realpath('target');
  const root = await realpath(resolve(target, TARGET_WORKSPACE));
  assert.ok(root === target || root.startsWith(target + sep), 'Workspace is outside the target repository');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: target, encoding: 'utf8' }).trim();
  assert.equal(revision, unit.source.revision, 'Target revision differs from the reviewed plan');
  const local = await validateOpenSpec(root);
  assert.equal(local.change, unit.change, 'Child OpenSpec identity differs from the reviewed plan');
  const link = join(root, '.forge/shared-change.json');
  assert.ok((await lstat(link)).isFile(), 'Expected a reviewed shared-change reference');
  assert.deepEqual(JSON.parse(await readFile(link)), plan.specification, 'Child references a different shared change');
  const sharedPath = join(root, '.forge/shared-specification.json');
  assert.ok((await lstat(sharedPath)).isFile(), 'Expected the shared change file inventory');
  const shared = JSON.parse(await readFile(sharedPath));
  assert.equal(createHash('sha256').update(JSON.stringify(shared)).digest('hex'), plan.specification.sha256,
    'Shared specification inventory is stale');
  const globalPrefix = 'openspec/changes/' + plan.specification.change + '/';
  const localPrefix = 'openspec/changes/' + unit.change + '/';
  const deltas = Object.entries(shared).filter(([path]) => path.startsWith(globalPrefix + 'specs/') &&
    path.endsWith('/spec.md'));
  assert.ok(deltas.length, 'Missing shared specification deltas');
  for (const [path, digest] of deltas) {
    assert.equal(local.sha256[localPrefix + path.slice(globalPrefix.length)], digest,
      'Child changed a shared requirement delta');
  }
  for (const file of [...Object.keys(local.sha256), '.forge/shared-change.json', '.forge/shared-specification.json']) {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'pipe' });
    // The native APMX target stage copies the tree without .git. Reject ignored
    // approved files even when they were explicitly force-added to the repository.
    try {
      execFileSync('git', ['check-ignore', '--no-index', '--', file], { cwd: root, stdio: 'pipe' });
      throw new Error('Approved artifact is ignored: ' + file);
    } catch (error) {
      if (error.status !== 1) throw error;
    }
  }
} catch (error) {
  console.error('Product unit preflight failed. ' + error.message);
  process.exitCode = 1;
}
