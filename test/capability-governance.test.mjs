import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { assemble } from '../factory/assembly.mjs';
import { verifyAgentDeliveryPackage } from '../factory/agent-capability.mjs';

const readManifest = async () => JSON.parse(await readFile(new URL('../factory/packages.json', import.meta.url)));
const digest = data => createHash('sha256').update(data).digest('hex');

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'forge-capability-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('a revoked revision cannot be selected by any role or the rehearsal', async () => {
  const manifest = await readManifest();
  for (const reference of [assemble(manifest).packages.agentDelivery, assemble(manifest).rehearsal]) {
    manifest.revoked = [reference];
    assert.throws(() => assemble(manifest), /revoked/);
  }
});

test('repository casing cannot bypass a revocation for the same package path', async () => {
  const manifest = await readManifest();
  const reference = assemble(manifest).packages.architecture;
  manifest.capabilities.architecture.repository = 'RichGo/Forge-Kit-Skills';
  manifest.revoked = [reference];
  assert.throws(() => assemble(manifest), /revoked/);
  manifest.revoked = [reference.replace('/architecture#', '/Architecture#')];
  assert.doesNotThrow(() => assemble(manifest));
});

test('an incompatible runtime API is rejected before capability code is imported', async () => {
  const manifest = await readManifest();
  manifest.capabilities.agentDelivery.runtimeApi = 2;
  assert.throws(() => assemble(manifest), /runtime API/);
});

test('verified runtime exports are bound to the reviewed bytes', async t => {
  const root = await workspace(t);
  const manifest = await readManifest();
  const pkg = manifest.capabilities.agentDelivery;
  const sources = {
    'exports.json': JSON.stringify({ version: 1, runtimeApi: 1, exports: [
      { kind: 'architecture-plan', path: 'runtime/architecture-plan.mjs' },
      { kind: 'agent-production', path: 'runtime/agent-production.mjs' },
      { kind: 'agent-verification', path: 'runtime/agent-verifier.mjs' },
    ] }),
    'runtime/architecture-plan.mjs': 'export const planArchitecture = () => {};',
    'runtime/agent-production.mjs': 'export const produceRevision = () => {};',
    'runtime/agent-verifier.mjs': 'export const verifyCandidate = () => {};',
  };
  await mkdir(join(root, 'runtime'));
  for (const [path, source] of Object.entries(sources)) {
    await writeFile(join(root, path), source);
    pkg.sha256[path] = digest(source);
  }
  const report = await verifyAgentDeliveryPackage(manifest, root);
  assert.equal(report.ref, assemble(manifest).packages.agentDelivery);
  assert.deepEqual(report.sha256, pkg.sha256);

  const entry = join(root, 'runtime/agent-production.mjs');
  await writeFile(entry, 'throw new Error("modified")');
  await assert.rejects(verifyAgentDeliveryPackage(manifest, root), /digest mismatch/);
  await rm(entry);
  await assert.rejects(verifyAgentDeliveryPackage(manifest, root), /ENOENT/);
});
