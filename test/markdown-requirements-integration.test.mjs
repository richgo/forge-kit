import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readRevision } from '../factory/agent-delivery.mjs';
import { createRelease } from '../factory/pages.mjs';
import { requirementsPackage } from '../factory/requirements.mjs';

test('the agent catalog binds Markdown, preserves acceptance and rejects an unknown check', async t => {
  for (const name of ['stock-ledger', 'trail-desk']) {
    const root = join('examples', 'agent-products', name);
    const initial = await readRevision(root, 'initial');
    const next = await readRevision(root, 'next', initial.snapshot);
    assert.equal(initial.cases.length, 5);
    assert.equal(next.cases.length, 8);
    assert.equal(initial.requirements.compiler, 'forgekit-requirements/markdown-v1');
    assert.notEqual(initial.requirementsSha256, initial.archivedRequirementsSha256);
    assert.notEqual(next.requirements.sourceSha256, initial.requirements.sourceSha256);
  }
  const root = await mkdtemp(join(tmpdir(), 'forge-markdown-agent-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 }));
  await cp(join('examples', 'agent-products', 'stock-ledger', 'initial'), join(root, 'initial'), { recursive: true });
  const path = join(root, 'initial', 'product-requirements.md');
  await writeFile(path, (await readFile(path, 'utf8')).replace('ac-201', 'missing-check'));
  await assert.rejects(readRevision(root, 'initial'), /Unknown or mismatched independent check/);
});

test('the archived JSON receipt still passes its original trace and Pages verification', async () => {
  const { verifyTrace } = await requirementsPackage();
  const paths = ['product-requirements.json', 'plan.json', 'receipt.json', 'deployed.mjs'];
  const [requirements, rawPlan, rawReceipt, artifact] = await Promise.all(paths.map(file =>
    readFile(join('test', 'fixtures', 'apmx-story', file))));
  const receipt = JSON.parse(rawReceipt);
  const report = verifyTrace(requirements, JSON.parse(rawPlan), receipt, artifact);
  const release = createRelease({ artifact, report, receipt }, 'a'.repeat(40));
  assert.equal(release.manifest.story, 'STORY-001');
  assert.deepEqual(release.manifest.acceptance, ['AC-001', 'AC-002']);
});

test('the examples have a single authored requirements format', async () => {
  const entries = await readdir('examples', { recursive: true });
  assert.ok(entries.filter(name => name.endsWith('product-requirements.md')).length >= 13);
  assert.deepEqual(entries.filter(name => /(?:^|[\\/])(?:product-requirements|requirements|product)\.json$/.test(name)), []);
});
