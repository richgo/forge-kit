import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planArchitecture, renderLikeC4 } from '../factory/architecture-plan.mjs';

const node = (id, kind = 'service') => ({
  'unique-id': id, 'node-type': kind, name: id, description: 'Fixture component.',
});
const relationship = (id, kind, detail, protocol) => ({
  'unique-id': id, 'relationship-type': { [kind]: detail }, ...(protocol && { protocol }),
});
const connect = (source, destination, interfaces) => ({
  source: { node: source }, destination: { node: destination, ...(interfaces && { interfaces }) },
});
const transition = (id, number) => ({
  'relationship-unique-id': id, 'sequence-number': number, description: 'Perform a step.',
});

function architecture() {
  return {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [
      node('actor', 'actor'), node('gateway'), node('storage', 'database'),
      node('cluster-a', 'system'), node('cluster-b', 'system'), node('unrelated'),
      { ...node('stock-api'), interfaces: [{ 'unique-id': 'stock-v1', path: '/stock' }] },
    ],
    relationships: [
      relationship('look-up', 'interacts', { actor: 'actor', nodes: ['gateway'] }),
      relationship('gateway-to-stock', 'connects', connect('gateway', 'stock-api', ['stock-v1']), 'HTTPS'),
      relationship('persist', 'connects', connect('stock-api', 'storage'), 'JDBC'),
      relationship('host', 'deployed-in', { container: 'cluster-a', nodes: ['stock-api'] }),
      relationship('composition', 'composed-of', { container: 'cluster-a', nodes: ['storage'] }),
    ],
    flows: [{
      'unique-id': 'inventory', name: 'Look up inventory', description: 'End-to-end lookup.',
      transitions: [transition('look-up', 1), transition('gateway-to-stock', 2), transition('persist', 3)],
    }],
  };
}
const snapshot = calm => ({ calm, likec4: renderLikeC4(calm) });

test('creation traces every component, relationship and flow without a migration finding', () => {
  const result = planArchitecture(null, snapshot(architecture()));
  assert.deepEqual(result.affectedNodes, ['actor', 'cluster-a', 'cluster-b', 'gateway', 'stock-api', 'storage', 'unrelated']);
  assert.deepEqual(result.affectedFlows, ['inventory']);
  assert.deepEqual(result.breaking, []);
});

test('API contract changes reach transitive callers and affected business flows', () => {
  const before = architecture();
  const after = structuredClone(before);
  after.nodes.find(node => node['unique-id'] === 'stock-api').interfaces[0].path = '/v2/stock';
  const result = planArchitecture(snapshot(before), snapshot(after));
  assert.deepEqual(result.affectedNodes, ['actor', 'gateway', 'stock-api']);
  assert.deepEqual(result.affectedFlows, ['inventory']);
  assert.deepEqual(result.breaking, [{ kind: 'interface-changed', id: 'stock-v1', node: 'stock-api' }]);
});

test('a deployment migration and incompatible protocol name the old and new impact', () => {
  const before = architecture();
  const after = structuredClone(before);
  after.relationships.find(edge => edge['unique-id'] === 'host')['relationship-type']['deployed-in'].container = 'cluster-b';
  after.relationships.find(edge => edge['unique-id'] === 'gateway-to-stock').protocol = 'mTLS';
  const result = planArchitecture(snapshot(before), snapshot(after));
  assert.deepEqual(result.affectedNodes, ['actor', 'cluster-a', 'cluster-b', 'gateway', 'stock-api']);
  assert.deepEqual(result.breaking, [
    { kind: 'relationship-contract-changed', id: 'gateway-to-stock' },
    { kind: 'deployment-migration', id: 'host' },
  ]);
});

test('flow transitions must reference a known edge and have distinct sequence numbers', () => {
  const unknown = architecture();
  unknown.flows[0].transitions[0]['relationship-unique-id'] = 'nonexistent';
  assert.throws(() => renderLikeC4(unknown), /Unknown relationship nonexistent/);
  const duplicate = architecture();
  duplicate.flows[0].transitions[1]['sequence-number'] = 1;
  assert.throws(() => renderLikeC4(duplicate), /Duplicate sequence number/);
});

test('interface references must resolve on their own endpoint and deployment nodes must exist', () => {
  const reference = architecture();
  reference.relationships[1]['relationship-type'].connects.source.interfaces = ['stock-v1'];
  assert.throws(() => renderLikeC4(reference), /Unknown interface stock-v1 on gateway/);
  const deployment = architecture();
  deployment.relationships[3]['relationship-type']['deployed-in'].nodes.push('untracked');
  assert.throws(() => renderLikeC4(deployment), /Unknown node untracked/);
});

test('LikeC4 drift is rejected even when a changed interface leaves the same diagram edges', () => {
  const previous = snapshot(architecture());
  const calm = structuredClone(previous.calm);
  calm.nodes.find(node => node['unique-id'] === 'stock-api').interfaces[0].path = '/v2/stock';
  assert.throws(() => planArchitecture(previous, { calm, likec4: previous.likec4 }), /LikeC4 drift/);
  assert.throws(() => planArchitecture(null, { calm: previous.calm,
    likec4: previous.likec4.replace('stock-api', 'wrong') }), /LikeC4 drift/);
});

test('reordering model arrays and formatting object keys does not change the projected architecture', () => {
  const before = architecture();
  const after = structuredClone(before);
  after.nodes.reverse();
  after.relationships.reverse();
  after.flows[0].transitions.reverse();
  assert.equal(renderLikeC4(before), renderLikeC4(after));
  assert.deepEqual(planArchitecture(snapshot(before), snapshot(after)).affectedNodes, []);
});

test('the view displays actors, service dependencies and deployment relationships', () => {
  const view = renderLikeC4(architecture());
  assert.match(view, /element component/);
  assert.match(view, /component "stock-api"/);
  assert.match(view, /-> .*"gateway-to-stock \(connects\)"/);
  assert.match(view, /-> .*"host \(deployed-in\)"/);
});

test('adding a component to an existing deployment does not require a migration', () => {
  const before = architecture();
  const after = structuredClone(before);
  after.nodes.push(node('worker'));
  after.relationships.find(edge => edge['unique-id'] === 'host')['relationship-type']['deployed-in'].nodes.push('worker');
  const plan = planArchitecture(snapshot(before), snapshot(after));
  assert.deepEqual(plan.breaking, []);
  assert.ok(plan.affectedNodes.includes('worker'));
});

test('removing a provider preserves the old caller and flow impact', () => {
  const before = architecture();
  const after = structuredClone(before);
  after.nodes = after.nodes.filter(node => node['unique-id'] !== 'storage');
  after.relationships = after.relationships.filter(edge => !['persist', 'composition'].includes(edge['unique-id']));
  after.flows[0].transitions.pop();
  const plan = planArchitecture(snapshot(before), snapshot(after));
  assert.deepEqual(plan.affectedFlows, ['inventory']);
  assert.ok(plan.affectedNodes.includes('storage'));
  assert.ok(plan.affectedNodes.includes('actor'));
  assert.ok(plan.breaking.some(finding => finding.kind === 'node-removed' && finding.id === 'storage'));
  assert.ok(plan.breaking.some(finding => finding.kind === 'flow-contract-changed' && finding.id === 'inventory'));
});
