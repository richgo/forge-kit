import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as delivery from '../factory/agent-production.mjs';

const product = { id: 'sample', runtime: 'node', entry: 'src/main.mjs', files: ['src/main.mjs'],
  stories: [{ id: 'STORY-1', description: 'Echo a value', nodes: ['api'] }] };
const revision = { product, architecture: { affectedNodes: ['api'], breaking: [] } };

test('agent code can only write approved source files', () => {
  assert.deepEqual(delivery.acceptSource(product, { files: { 'src/main.mjs': 'export {}' } }),
    { 'src/main.mjs': 'export {}' });
  for (const files of [
    { 'src/main.mjs': 'export {}', '../verify.mjs': 'fake acceptance' },
    { 'src/main.mjs': '', 'src/test.mjs': 'fake' },
    { 'src/main.mjs': { content: 'export {}' } },
  ]) assert.throws(() => delivery.acceptSource(product, { files }));
});

test('Copilot tool use fails closed even if a final proposal was emitted', () => {
  const events = [
    { type: 'session.start', data: { sessionId: 'session-1' } },
    { type: 'assistant.message', data: { content: '{"plan":"Implement echo"}' } },
  ];
  const parse = values => delivery.readAgentEvents(values.map(value => JSON.stringify(value)).join('\n'));
  assert.deepEqual(parse(events).value, { plan: 'Implement echo' });
  assert.throws(() => parse([...events, { type: 'tool.execution_start', data: { toolName: 'shell' } }]));
});

test('a failed candidate gets one repair and the next revision receives verified source', async () => {
  const original = { 'src/main.mjs': 'throw new Error()' };
  const accepted = { 'src/main.mjs': 'export const echo = x => x;' };
  const changed = { 'src/main.mjs': 'export const echo = x => ({ x });' };
  const calls = [];
  const agent = async (role, context) => {
    calls.push([role, context]);
    const values = { plan: { plan: 'Implement echo' }, code: { files: context.previous ? changed : original },
      test: { risks: ['Validate error handling'] }, review: { issues: [] }, repair: { files: accepted } };
    return { value: values[role], trace: { sessionId: role } };
  };
  const check = async (_revision, candidate) => ({ passed: candidate !== original &&
    candidate['src/main.mjs'] !== original['src/main.mjs'], checks: [{ id: 'AC-1', story: 'STORY-1', passed: false }] });
  const first = await delivery.produceRevision(revision, null, { agent, check });
  const next = await delivery.produceRevision(revision, first.candidate, { agent, check });
  assert.deepEqual(first.candidate, accepted);
  assert.deepEqual(next.candidate, changed);
  assert.equal(calls.filter(([role]) => role === 'repair').length, 1);
  assert.deepEqual(calls.filter(([role]) => role === 'code')[1][1].previous, accepted);
  assert.ok(calls.every(([, context]) => !Object.hasOwn(context, 'cases')));
});

test('failed repair exhausts the per-revision budget', async () => {
  const source = { files: { 'src/main.mjs': 'export {}' } };
  let repairs = 0;
  const agent = async role => {
    if (role === 'repair') repairs++;
    return { value: ({ plan: { plan: 'Implement' }, test: { risks: [] }, review: { issues: [] } })[role] ?? source };
  };
  await assert.rejects(delivery.produceRevision(revision, null, { agent, check: async () => ({ passed: false, checks: [] }) }),
    /repair budget/);
  assert.equal(repairs, 1);
});


test('breaking architecture changes require a tracked migration story for each finding', () => {
  const impact = { affectedNodes: ['api'], breaking: [{ kind: 'interface-changed', id: 'api-input', node: 'api' }] };
  assert.throws(() => delivery.approveArchitectureChanges(product, impact), /migration/);
  assert.throws(() => delivery.approveArchitectureChanges({ ...product,
    migrations: [{ kind: 'interface-changed', id: 'api-input', story: 'STORY-999' }] }, impact), /migration/);
  assert.doesNotThrow(() => delivery.approveArchitectureChanges({ ...product,
    migrations: [{ kind: 'interface-changed', id: 'api-input', story: 'STORY-1' }] }, impact));
});
