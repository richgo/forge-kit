import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planProductChange, verifyProductChange, releaseProductChange } from '../factory/product-change.mjs';

const commit = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const architecture = { nodes: ['contract', 'api', 'web'].map(id => ({ 'unique-id': id })) };
const capabilities = {
  secure: { package: 'org/catalog/packages/secure', ref: commit, sha256: digest, mandatory: true },
  node: { package: 'org/catalog/packages/node', ref: commit, sha256: digest, stacks: ['node'] },
  go: { package: 'org/catalog/packages/go', ref: commit, sha256: digest, stacks: ['go'] },
};
function manifest(repositories) {
  return {
    apiVersion: 'forgekit.dev/v1alpha1',
    kind: 'ProductChange',
    metadata: { id: 'CHECKOUT-1' },
    specification: { store: 'org/specs', change: 'update-checkout', revision: commit, sha256: digest },
    verification: { require: ['architecture-conformance', 'contract-compatibility', 'system-acceptance'] },
    implementations: ['contract', 'api', 'web'].map((id, index) => ({
      id, component: id, stories: ['STORY-001'], change: 'checkout-' + id, owner: 'org/checkout',
      source: { repository: repositories[index], path: 'packages/' + id, revision: commit },
      build: { target: id, stack: index === 1 ? 'go' : 'node' },
      requires: index ? [['contract', 'api'][index - 1]] : [],
      ...(index ? { deploy: { unit: id } } : {}),
    })),
  };
}

function plan(repositories = ['org/mono', 'org/mono', 'org/mono']) {
  return planProductChange(manifest(repositories), {
    architecture, architectureSha256: digest, likec4Sha256: digest, capabilities,
    changedPaths: [{ repository: repositories[0], path: 'packages/contract/schema.json' }],
  });
}

test('shared library changes select downstream Go and Node builds in every topology', () => {
  for (const repos of [['org/mono', 'org/mono', 'org/mono'], ['org/common', 'org/backend', 'org/front'],
    ['org/mono', 'org/backend', 'org/mono']]) {
    const result = plan(repos);
    assert.deepEqual(result.waves, [['contract'], ['api'], ['web']]);
    assert.deepEqual(result.units.api.capabilities.map(entry => entry.id), ['go', 'secure']);
    assert.equal(result.units.web.source.repository, repos[2]);
    assert.equal(result.units.web.contract.action, 'forgekit.openspec.apply');
  }
});

test('unsafe overlapping paths and a cyclic dependency are rejected', () => {
  const input = manifest(['org/mono', 'org/mono', 'org/mono']);
  const context = { architecture, architectureSha256: digest, likec4Sha256: digest, capabilities };
  input.implementations[0].source.path = 'packages';
  assert.throws(() => planProductChange(input, context), /overlap/);
  input.implementations[0].source.path = 'packages/contract';
  input.implementations[0].requires = ['web'];
  assert.throws(() => planProductChange(input, context), /cycle/);
});

function adapters(state = {}) {
  return {
    build: async () => ({ sha256: digest }),
    verifyUnit: async (unit, artifact, context) => ({
      unit: unit.id, sourceRevision: unit.source.revision, planSha256: context.planSha256,
      artifactSha256: digest, receiptSha256: digest, passed: true, ...state.unit,
    }),
    verifySystem: async candidate => ({
      candidateSha256: candidate.sha256, receiptSha256: digest,
      checks: { 'architecture-conformance': true, 'contract-compatibility': !state.incompatible, 'system-acceptance': true }, ...state.system,
    }),
  };
}

test('stale unit evidence and incompatible system candidates cannot qualify', async () => {
  await assert.rejects(verifyProductChange(plan(), adapters({ unit: { planSha256: digest } })), /unit evidence/);
  await assert.rejects(verifyProductChange(plan(), adapters({ incompatible: true })), /contract-compatibility/);
});

test('release restores affected services in reverse order after failed readiness', async () => {
  const events = [];
  const verified = await verifyProductChange(plan(), adapters());
  const release = await releaseProductChange(verified, {
    authenticate: async () => true,
    current: async ({ id }) => (events.push('current:' + id), { baseline: true, artifactSha256: digest }),
    deploy: async ({ id }) => events.push('deploy:' + id),
    observe: async ({ id }, artifact) => artifact.baseline ? true : id !== 'web',
    rollback: async ({ id }) => events.push('rollback:' + id),
  });
  assert.equal(release.status, 'rolled-back');
  assert.deepEqual(events, ['current:api', 'current:web', 'deploy:api', 'deploy:web', 'rollback:web', 'rollback:api']);
});
