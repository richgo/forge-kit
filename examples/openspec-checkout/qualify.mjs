import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planImpact } from '../../factory/impact.mjs';
import { validateOpenSpec } from '../../bin/openspec.mjs';
import { planProductChange, releaseProductChange, verifyProductChange } from '../../factory/product-change.mjs';

const fixture = fileURLToPath(new URL('./', import.meta.url));
const read = path => readFileSync(join(fixture, path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => sha(JSON.stringify(value));
const files = { contract: 'schema.json', api: 'checkout.py', web: 'checkout.mjs' };
const stacks = { contract: 'json', api: 'python', web: 'node' };
const calm = read('architecture/system.calm.json');
const likec4 = read('architecture/system.c4');
const architecture = JSON.parse(calm);
const snapshot = { requirements: { schemaVersion: 1, epics: [] }, calm: architecture, view: likec4.toString('utf8') };
const architectureCheck = planImpact(snapshot, snapshot);
const specification = await validateOpenSpec(fixture, { tool: process.env.FORGE_OPENSPEC_TOOL });
const python = process.env.FORGE_REFERENCE_PYTHON || 'python3';

function git(root, ...args) {
  return execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' }).trim();
}

function commit(root, message) {
  git(root, 'add', '.');
  git(root, '-c', 'user.name=ForgeKit reference', '-c', 'user.email=reference@example.test', 'commit', '-qm', message);
  return git(root, 'rev-parse', 'HEAD');
}

function repository(root, name) {
  const path = join(root, name);
  mkdirSync(path);
  git(path, 'init', '-q');
  return path;
}

function runSystem(artifacts) {
  const expected = JSON.parse(readFileSync(artifacts.contract));
  const response = execFileSync(python, [artifacts.api, artifacts.contract], { encoding: 'utf8' });
  const payload = JSON.parse(response);
  const compatibility = expected.required.every(key => Object.hasOwn(payload, key)) &&
    Number.isInteger(payload.total) && payload.currency === expected.currency;
  let accepted = false;
  if (compatibility) {
    const displayed = execFileSync(process.execPath, [artifacts.web], { encoding: 'utf8', input: response }).trim();
    accepted = displayed === '£25.00';
  }
  return { 'contract-compatibility': compatibility, 'system-acceptance': accepted };
}

async function qualify(topology, names, fault = '') {
  const root = mkdtempSync(join(tmpdir(), 'forgekit-checkout-'));
  try {
    const source = Object.fromEntries([...new Set(names)].map(name => [name, repository(root, name)]));
    const specs = repository(root, 'specs');
    for (const path of [...Object.keys(specification.sha256), 'specs/product-requirements.md',
      'architecture/system.calm.json', 'architecture/system.c4']) {
      const destination = join(specs, path);
      mkdirSync(join(destination, '..'), { recursive: true });
      writeFileSync(destination, read(path));
    }
    const specCommit = commit(specs, 'Approve checkout specification and models');
    for (const [index, [unit, file]] of Object.entries(files).entries()) {
      const path = join(source[names[index]], 'services', unit);
      mkdirSync(path, { recursive: true });
      const original = unit === 'api'
        ? 'import json\nprint(json.dumps({"total": 2500}))\n'
        : read('services/' + unit + '/' + file);
      writeFileSync(join(path, file), original);
    }
    const revisions = Object.fromEntries(Object.entries(source).map(([name, path]) =>
      [name, commit(path, 'Record existing service implementation')]));
    const catalog = Object.fromEntries(Object.entries(files).map(([unit, file]) => [
      stacks[unit], { package: 'reference/skills/packages/' + stacks[unit], ref: specCommit,
        sha256: sha(read('services/' + unit + '/' + file)), stacks: [stacks[unit]] },
    ]));
    const manifest = {
      apiVersion: 'forgekit.dev/v1alpha1', kind: 'ProductChange', metadata: { id: 'CHECKOUT-1' },
      specification: { store: 'reference/specs', change: specification.change, revision: specCommit,
        sha256: hash(specification.sha256) },
      verification: { require: ['architecture-conformance', 'contract-compatibility', 'system-acceptance'] },
      implementations: Object.keys(files).map((unit, index) => ({
        id: unit, component: 'checkout_' + unit, stories: ['STORY-001'], change: 'checkout-' + unit,
        owner: 'reference/checkout',
        source: { repository: 'reference/' + names[index], path: 'services/' + unit,
          revision: revisions[names[index]] },
        build: { target: unit, stack: stacks[unit] },
        requires: { contract: [], api: ['contract'], web: ['api'] }[unit],
        ...(unit === 'contract' ? {} : { deploy: { unit } }),
      })),
    };
    const plan = planProductChange(manifest, { architecture: JSON.parse(calm), architectureSha256: sha(calm),
      likec4Sha256: sha(likec4), capabilities: catalog,
      changedPaths: [{ repository: 'reference/' + names[0], path: 'services/contract/schema.json' }] });
    assert.deepEqual(plan.waves, [['contract'], ['api'], ['web']]);
    const baselines = Object.fromEntries(Object.entries(plan.units).map(([id, unit]) =>
      [id, join(source[unit.source.repository.split('/')[1]], unit.source.path, files[id])]));
    assert.equal(runSystem(baselines)['contract-compatibility'], false, 'Brownfield contract should fail before the fix');
    const artifacts = {};
    const adapters = {
      build: async unit => {
        const name = unit.source.repository.split('/')[1];
        assert.equal(git(source[name], 'rev-parse', 'HEAD'), unit.source.revision);
        const artifact = join(root, files[unit.id]);
        if (fault === 'incompatible' && unit.id === 'api') copyFileSync(baselines.api, artifact);
        else writeFileSync(artifact, read('services/' + unit.id + '/' + files[unit.id]));
        return { path: artifact, sha256: sha(readFileSync(artifact)) };
      },
      verifyUnit: async (unit, { path: artifact }, context) => {
        if (unit.id === 'api') {
          execFileSync(python, ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read())', artifact]);
        } else if (unit.id === 'web') {
          execFileSync(process.execPath, ['--check', artifact]);
        } else {
          assert.ok(JSON.parse(readFileSync(artifact)).required.includes('currency'));
        }
        artifacts[unit.id] = artifact;
        const receipt = { unit: unit.id, sourceRevision: unit.source.revision, planSha256: context.planSha256,
          artifactSha256: sha(readFileSync(artifact)), passed: true };
        return { ...receipt, receiptSha256: hash(receipt) };
      },
      verifySystem: async candidate => {
        for (const [unit, receipt] of Object.entries(candidate.units)) {
          assert.equal(sha(readFileSync(artifacts[unit])), receipt.artifactSha256);
        }
        const checks = { ...runSystem(artifacts), 'architecture-conformance': architectureCheck.scope.nodes.length === 0 };
        return { candidateSha256: candidate.sha256, checks, receiptSha256: hash(checks) };
      },
    };
    if (fault === 'incompatible' || fault === 'stale') {
      if (fault === 'stale') {
        const check = adapters.verifyUnit;
        adapters.verifyUnit = async (...args) => ({ ...await check(...args), planSha256: '0'.repeat(64) });
      }
      await assert.rejects(verifyProductChange(plan, adapters), fault === 'stale' ? /stale unit evidence/ : /contract-compatibility/);
      return { topology, fault, status: 'blocked' };
    }
    const verified = await verifyProductChange(plan, adapters);
    const installed = Object.fromEntries(['api', 'web'].map(id => {
      const path = join(root, 'installed-' + files[id]);
      copyFileSync(baselines[id], path);
      return [id, path];
    }));
    const release = await releaseProductChange(verified, {
      authenticate: async result => result.candidate.sha256 === verified.candidate.sha256 && runSystem(artifacts)['system-acceptance'],
      current: async ({ id }) => ({ baseline: true, path: baselines[id], artifactSha256: sha(readFileSync(baselines[id])) }),
      deploy: async ({ id }, receipt, candidate, baseline) => {
        assert.equal(sha(readFileSync(artifacts[id])), receipt.artifactSha256);
        assert.equal(sha(readFileSync(installed[id])), baseline.artifactSha256);
        copyFileSync(artifacts[id], installed[id]);
      },
      observe: async ({ id }, receipt) => (receipt.baseline || fault !== 'failed-rollout' || id !== 'web') &&
        sha(readFileSync(installed[id])) === receipt.artifactSha256,
      rollback: async ({ id }, baseline, candidate, attempted) => {
        assert.equal(sha(readFileSync(installed[id])), attempted.artifactSha256);
        copyFileSync(baseline.path, installed[id]);
      },
    });
    assert.equal(release.status, fault ? 'rolled-back' : 'released');
    if (!fault) assert.equal(runSystem({ ...installed, contract: artifacts.contract })['system-acceptance'], true);
    return { topology, fault: fault || null, sourceRepositories: Object.keys(source).length,
      specification: specification.change, verifiedUnits: Object.keys(verified.candidate.units),
      candidateSha256: verified.candidate.sha256, checks: verified.system.checks, status: release.status };
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  }
}

for (const [topology, names] of Object.entries({
  monorepo: ['mono', 'mono', 'mono'],
  'multi-repo': ['contracts', 'backend', 'frontend'],
  hybrid: ['common', 'backend', 'common'],
})) {
  console.log(JSON.stringify(await qualify(topology, names)));
}
for (const fault of ['incompatible', 'stale', 'failed-rollout']) {
  console.log(JSON.stringify(await qualify('multi-repo', ['contracts', 'backend', 'frontend'], fault)));
}
