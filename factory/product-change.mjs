import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const id = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const repository = /^[a-z\d][a-z\d-]*\/[a-z\d_.-]+$/;
const revision = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;
const within = (child, parent) => parent === '.' || child === parent || child.startsWith(parent + '/');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function immutable(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function match(value, pattern, label) {
  assert.ok(typeof value === 'string' && pattern.test(value), 'Invalid ' + label);
  return value;
}

export function validateProductPlan(plan) {
  const { sha256, ...inputs } = plan;
  assert.equal(inputs.schema, 1, 'Unsupported product plan');
  assert.equal(hash(inputs), sha256, 'Product change plan digest mismatch');
  return sha256;
}

function list(value, label, pattern = id) {
  assert.ok(Array.isArray(value), 'Expected ' + label);
  assert.equal(new Set(value).size, value.length, 'Duplicate ' + label);
  return value.map(item => match(item, pattern, label)).sort();
}

function path(value, label) {
  if (value === '.') return value;
  match(value, /^[a-zA-Z0-9_./-]+$/, label);
  assert.ok(value.split('/').every(part => part && part !== '.' && !part.endsWith('.')),
    'Unsafe ' + label);
  return value;
}

function dependencyWaves(units) {
  const remaining = new Set(Object.keys(units).sort());
  const waves = [];
  while (remaining.size) {
    const wave = [...remaining].filter(key => units[key].requires.every(dependency => !remaining.has(dependency)));
    assert.ok(wave.length, 'Implementation dependency cycle');
    waves.push(wave);
    for (const key of wave) remaining.delete(key);
  }
  return waves;
}

function lockCapabilities(catalog, stack) {
  const locks = [];
  for (const [key, entry] of Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    match(key, id, 'capability ID');
    const stacks = list(entry.stacks ?? [], 'capability stacks');
    if (entry.mandatory !== true && !stacks.includes(stack)) continue;
    locks.push({
      id: key,
      package: match(entry.package, /^[a-z\d-]+\/[a-z\d_.-]+(?:\/[a-z\d_-]+)+$/, 'APM package'),
      ref: match(entry.ref, revision, 'APM package ref'),
      sha256: match(entry.sha256, digest, 'APM package digest'),
    });
  }
  assert.ok(Object.values(catalog).some(entry => entry.stacks?.includes(stack)), 'No capability for ' + stack);
  assert.equal(new Set(locks.map(lock => lock.package)).size, locks.length, 'Conflicting capability packages');
  return locks;
}

export function planProductChange(manifest, {
  architecture, architectureSha256, likec4Sha256, capabilities, changedPaths = [], impactedComponents = [],
}) {
  assert.equal(manifest.apiVersion, 'forgekit.dev/v1alpha1', 'Unsupported ProductChange version');
  assert.equal(manifest.kind, 'ProductChange');
  const change = match(manifest.metadata?.id, /^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'product change ID');
  const spec = {
    store: match(manifest.specification?.store, repository, 'specification store'),
    change: match(manifest.specification?.change, id, 'OpenSpec change'),
    revision: match(manifest.specification?.revision, revision, 'specification revision'),
    sha256: match(manifest.specification?.sha256, digest, 'specification digest'),
  };
  const models = {
    calm: match(architectureSha256, digest, 'CALM digest'),
    likec4: match(likec4Sha256, digest, 'LikeC4 digest'),
  };
  assert.ok(Array.isArray(architecture?.nodes), 'CALM nodes are required');
  const components = new Set(architecture.nodes.map(node => node['unique-id']));
  const required = list(manifest.verification?.require, 'system check IDs');
  for (const check of ['architecture-conformance', 'contract-compatibility', 'system-acceptance']) {
    assert.ok(required.includes(check), 'Missing required system check ' + check);
  }
  assert.ok(Array.isArray(manifest.implementations) && manifest.implementations.length,
    'At least one implementation unit is required');
  const units = Object.create(null);
  const deployments = new Set();
  const localChanges = new Set();
  for (const entry of manifest.implementations) {
    const key = match(entry.id, id, 'unit ID');
    assert.ok(!units[key], 'Duplicate unit ' + key);
    assert.ok(components.has(entry.component), 'Unknown CALM component ' + entry.component);
    const stories = list(entry.stories, 'story IDs', /^STORY-[A-Z0-9][A-Z0-9-]*$/);
    assert.ok(stories.length, 'Missing stories for ' + key);
    const source = {
      repository: match(entry.source?.repository, repository, 'source repository'),
      path: path(entry.source?.path, 'source path'),
      revision: match(entry.source?.revision, revision, 'source revision'),
    };
    const child = match(entry.change, id, 'child OpenSpec change');
    const local = source.repository + ':' + source.path + ':' + child;
    assert.ok(!localChanges.has(local), 'Duplicate child OpenSpec change ' + local);
    localChanges.add(local);
    const deploy = entry.deploy ? { unit: match(entry.deploy.unit, id, 'deployment unit') } : null;
    if (deploy) {
      assert.ok(!deployments.has(deploy.unit), 'Duplicate deployment unit ' + deploy.unit);
      deployments.add(deploy.unit);
    }
    for (const other of Object.values(units)) {
      if (other.source.repository !== source.repository) continue;
      assert.equal(other.source.revision, source.revision, 'Conflicting baselines for ' + source.repository);
      const [first, second] = [other.source.path, source.path].map(value => value.toLowerCase());
      assert.ok(!within(first, second) && !within(second, first), 'Implementation paths overlap in ' + source.repository);
    }
    const stack = match(entry.build?.stack, id, 'build stack');
    units[key] = {
      id: key, component: entry.component, stories, change: child, source, deploy,
      owner: match(entry.owner, repository, 'owning team'),
      build: { stack, target: match(entry.build?.target, id, 'build target') },
      requires: list(entry.requires ?? [], 'unit dependencies'),
      capabilities: lockCapabilities(capabilities, stack),
      contract: { schema: 1, action: 'forgekit.openspec.apply' },
    };
  }
  for (const unit of Object.values(units)) {
    for (const dependency of unit.requires) assert.ok(units[dependency], 'Unknown dependency ' + dependency);
  }
  const consumers = new Map([...components].map(key => [key, new Set()]));
  for (const relationship of architecture.relationships ?? []) {
    const connection = relationship['relationship-type']?.connects;
    if (!connection) continue;
    const { source, destination } = connection;
    assert.ok(components.has(source?.node) && components.has(destination?.node), 'Unknown CALM connection endpoint');
    consumers.get(destination.node).add(source.node);
  }
  const ordered = dependencyWaves(units);
  const impacts = new Set(impactedComponents);
  for (const component of impacts) assert.ok(components.has(component), 'Unknown impacted component ' + component);
  const changed = changedPaths.map(entry => ({
    repository: match(entry.repository, repository, 'changed repository'),
    path: path(entry.path, 'changed path'),
  }));
  for (const entry of changed) {
    assert.ok(Object.values(units).some(unit => unit.source.repository === entry.repository &&
      within(entry.path, unit.source.path)), 'Changed path has no implementation owner: ' + entry.path);
  }
  const selective = changed.length || impacts.size;
  const affected = new Set(Object.values(units).filter(unit => !selective ||
    changed.some(entry => entry.repository === unit.source.repository && within(entry.path, unit.source.path)))
    .map(unit => unit.id));
  for (const unit of affected) impacts.add(units[unit].component);
  let previousSize;
  do {
    previousSize = impacts.size + affected.size;
    for (const component of impacts) {
      for (const consumer of consumers.get(component)) impacts.add(consumer);
    }
    for (const unit of Object.values(units)) {
      if (impacts.has(unit.component) || unit.requires.some(dep => affected.has(dep))) {
        affected.add(unit.id);
        impacts.add(unit.component);
      }
    }
  } while (previousSize !== impacts.size + affected.size);
  const waves = ordered.map(wave => wave.filter(key => affected.has(key))).filter(wave => wave.length);
  assert.ok(affected.size, 'No implementation units affected');
  const plan = { schema: 1, change, specification: spec, models, required,
    units: Object.fromEntries(Object.keys(units).sort().map(key => [key, units[key]])), waves };
  return immutable({ ...plan, sha256: hash(plan) });
}

// Adapters run APMX and authenticate the independent receipts in the deployment environment.
export async function verifyProductChange(input, { build, verifyUnit, verifySystem, reuse }) {
  const plan = immutable(structuredClone(input));
  const planSha256 = validateProductPlan(plan);
  const receipts = new Map();
  const check = (unit, result) => {
    assert.ok(result?.unit === unit.id && result.sourceRevision === unit.source.revision &&
      result.planSha256 === planSha256 && result.passed === true &&
      digest.test(result.artifactSha256 ?? '') && digest.test(result.receiptSha256 ?? ''),
    'Invalid, failed or stale unit evidence for ' + unit.id);
    receipts.set(unit.id, immutable(structuredClone(result)));
  };
  const affected = new Set(plan.waves.flat());
  for (const unit of Object.values(plan.units).filter(unit => !affected.has(unit.id))) {
    assert.equal(typeof reuse, 'function', 'Missing authenticated baseline adapter for ' + unit.id);
    check(unit, await reuse(unit, { planSha256, specification: plan.specification, models: plan.models }));
  }
  for (const wave of plan.waves) {
    const results = await Promise.allSettled(wave.map(async key => {
      const unit = plan.units[key];
      const dependencies = Object.fromEntries(unit.requires.map(dep => [dep, receipts.get(dep) ?? null]));
      const context = immutable({ planSha256, specification: plan.specification, models: plan.models, dependencies });
      const artifact = immutable(structuredClone(await build(unit, context)));
      const checked = await verifyUnit(unit, artifact, context);
      assert.ok(digest.test(artifact?.sha256 ?? '') && artifact.sha256 === checked?.artifactSha256,
        'Artifact digest differs from independently replayed build for ' + key);
      return [key, { ...checked }];
    }));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(result => result.reason),
      failures.map(result => result.reason?.message ?? String(result.reason)).join('; '));
    for (const result of results) check(plan.units[result.value[0]], result.value[1]);
  }
  const payload = { schema: 1, change: plan.change, planSha256, specification: plan.specification,
    models: plan.models, units: Object.fromEntries(receipts) };
  const candidate = { ...payload, sha256: hash(payload) };
  const system = await verifySystem(structuredClone(candidate));
  assert.ok(system?.candidateSha256 === candidate.sha256 && digest.test(system.receiptSha256 ?? ''),
    'Missing or stale system evidence');
  for (const check of plan.required) assert.equal(system.checks?.[check], true, 'Failed system check ' + check);
  return immutable({ plan, candidate, system: structuredClone(system) });
}

export async function releaseProductChange(input, { authenticate, current, deploy, observe, rollback }) {
  const verified = immutable(structuredClone(input));
  assert.equal(await authenticate(verified), true, 'Release requires authenticated qualification');
  const { plan, candidate, system } = verified;
  const planSha256 = validateProductPlan(plan);
  const { sha256: candidateSha256, ...payload } = candidate;
  assert.ok(hash(payload) === candidateSha256 &&
    candidate.planSha256 === planSha256 && system.candidateSha256 === candidateSha256 &&
    plan.required.every(check => system.checks?.[check] === true), 'Release qualification digest mismatch');
  const units = plan.waves.flat().map(key => plan.units[key]).filter(unit => unit.deploy);
  const previous = new Map();
  const attempted = [];
  const recovery = [];
  try {
    for (const unit of units) {
      const baseline = await current(unit);
      assert.ok(digest.test(baseline?.artifactSha256 ?? ''), 'Missing recovery baseline for ' + unit.id);
      previous.set(unit.id, immutable(structuredClone(baseline)));
    }
    for (const unit of units) {
      const artifact = candidate.units[unit.id];
      assert.ok(artifact, 'Missing verified artifact for ' + unit.id);
      attempted.push(unit);
      await deploy(unit, artifact, candidate, previous.get(unit.id));
      assert.equal(await observe(unit, artifact), true, 'Readiness failed for ' + unit.id);
    }
    return { status: 'released', candidateSha256, deployed: attempted.map(unit => unit.id) };
  } catch (error) {
    for (const unit of attempted.reverse()) {
      try {
        const baseline = previous.get(unit.id);
        await rollback(unit, baseline, candidate, candidate.units[unit.id]);
        assert.equal(await observe(unit, baseline), true, 'Restored readiness failed');
        recovery.push({ unit: unit.id, status: 'restored' });
      } catch (failure) {
        recovery.push({ unit: unit.id, status: 'failed', reason: failure.message });
      }
    }
    const status = !attempted.length ? 'blocked' :
      recovery.some(item => item.status === 'failed') ? 'partial' : 'rolled-back';
    return { status, candidateSha256, reason: error.message, recovery };
  }
}
