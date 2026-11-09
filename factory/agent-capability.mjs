import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assemble } from './assembly.mjs';

const exportsV1 = [
  { kind: 'architecture-plan', path: 'runtime/architecture-plan.mjs' },
  { kind: 'agent-production', path: 'runtime/agent-production.mjs' },
  { kind: 'agent-verification', path: 'runtime/agent-verifier.mjs' },
];
const modules = exportsV1.map(entry => entry.path);
const packageRoot = fileURLToPath(new URL('../apm_modules/richgo/forge-kit-skills/packages/agent-delivery/', import.meta.url));
const readManifest = async () => JSON.parse(await readFile(new URL('./packages.json', import.meta.url)));

export async function verifyAgentDeliveryPackage(manifest, root) {
  const { packages } = assemble(manifest);
  const capability = manifest.capabilities.agentDelivery;
  assert.ok(capability, 'Agent delivery capability is required');
  const { sha256, runtimeApi } = capability;
  const paths = ['exports.json', ...modules].sort();
  assert.deepEqual(Object.keys(sha256 ?? {}).sort(), paths, 'Reviewed digests must cover the complete runtime API');
  assert.ok((await lstat(root)).isDirectory(), 'Capability package must be a directory');
  const runtime = join(root, 'runtime');
  assert.ok((await lstat(runtime)).isDirectory(), 'Capability runtime must be a directory');
  let metadata;
  for (const path of paths) {
    assert.match(sha256[path], /^[a-f0-9]{64}$/, 'Invalid reviewed package digest');
    const file = join(root, path);
    assert.ok((await lstat(file)).isFile(), 'Capability export must be a regular file');
    const bytes = await readFile(file);
    const actual = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actual, sha256[path], 'Capability digest mismatch for ' + path);
    if (path === 'exports.json') metadata = JSON.parse(bytes);
  }
  assert.deepEqual((await readdir(runtime)).sort(), modules.map(path => path.slice(8)).sort(),
    'Unreviewed capability runtime files');
  assert.equal(metadata.version, 1, 'Incompatible capability export format');
  assert.equal(metadata.runtimeApi, runtimeApi, 'Incompatible capability runtime API');
  assert.deepEqual(metadata.exports, exportsV1, 'Incompatible capability export paths');
  return { ref: packages.agentDelivery, runtimeApi, sha256, exports: metadata.exports };
}

let verifiedRuntime;
export async function loadAgentDelivery(name) {
  const entry = 'runtime/' + name;
  assert.ok(modules.includes(entry), 'Unknown agent delivery capability export');
  verifiedRuntime ??= (async () => {
    const root = resolve(process.env.FORGE_AGENT_DELIVERY_PACKAGE || packageRoot);
    await verifyAgentDeliveryPackage(await readManifest(), root);
    return root;
  })();
  return import(pathToFileURL(join(await verifiedRuntime, entry)));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(process.argv[2] || process.env.FORGE_AGENT_DELIVERY_PACKAGE || packageRoot);
  console.log(JSON.stringify(await verifyAgentDeliveryPackage(await readManifest(), root)));
}
