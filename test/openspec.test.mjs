import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateOpenSpec } from '../bin/openspec.mjs';

const tool = process.env.FORGE_OPENSPEC_TOOL;
const fixture = new URL('../examples/openspec-checkout/', import.meta.url);

test('legacy consumers can skip OpenSpec when checking an optional binding', async t => {
  const root = await mkdtemp(join(tmpdir(), 'forge-openspec-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await validateOpenSpec(root, { optional: true }), { status: 'skipped' });
  await assert.rejects(validateOpenSpec(root), /openspec\.json/);
  await mkdir(join(root, '.forge'));
  await writeFile(join(root, '.forge/openspec.json'), '{"schema":1,"change":"--all","acceptance":{}}');
  await assert.rejects(validateOpenSpec(root, { optional: true }), /change slug/);
});

test('binding rejects references outside the selected change', async t => {
  const root = await mkdtemp(join(tmpdir(), 'forge-openspec-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.forge'));
  await writeFile(join(root, '.forge/openspec.json'), JSON.stringify({
    schema: 1, change: 'update-checkout',
    acceptance: { 'AC-001': { spec: 'openspec/changes/other/specs/orders/spec.md', scenario: 'Checkout' } },
  }));
  await assert.rejects(validateOpenSpec(root), /spec path/);
});

test('upstream OpenSpec 2 validates the reviewed change and rejects a missing scenario', { skip: !tool }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'forge-openspec-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixture, root, { recursive: true });
  const valid = await validateOpenSpec(root, { tool });
  assert.equal(valid.status, 'valid');
  assert.equal(valid.change, 'update-checkout');
  const bad = join(root, 'openspec/changes/update-checkout/specs/checkout/spec.md');
  await writeFile(bad, '## ADDED Requirements\n### Requirement: Checkout\nIt SHALL work.\n');
  await assert.rejects(validateOpenSpec(root, { tool }), /scenario|OpenSpec validation/i);
});
