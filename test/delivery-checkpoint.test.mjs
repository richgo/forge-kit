import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as state from '../factory/delivery-checkpoint.mjs';

const identity = { source: 'a'.repeat(40), run: '512', product: 'ledger',
  requirementsSha256: 'b'.repeat(64), capabilityLockSha256: 'c'.repeat(64) };
const candidate = { candidate: { 'src/main.py': 'print(1)' }, plan: 'Create entry point', repairs: 0 };
const audit = [{ revision: 'initial', role: 'plan' }];

test('a retry can reuse a checkpoint only for the same run, product, inputs and lock', () => {
  const checkpoint = state.createCheckpoint(identity, candidate, audit);
  assert.deepEqual(state.readCheckpoint(checkpoint, identity), { candidate, audit });
  for (const changes of [
    { run: '513' }, { product: 'other' }, { source: 'd'.repeat(40) },
    { requirementsSha256: 'e'.repeat(64) }, { capabilityLockSha256: 'f'.repeat(64) },
  ]) assert.throws(() => state.readCheckpoint(checkpoint, { ...identity, ...changes }), /identity/);
});

test('tampered source or audit cannot be resumed', () => {
  const checkpoint = state.createCheckpoint(identity, candidate, audit);
  const changed = structuredClone(checkpoint);
  changed.payload.candidate.candidate['src/main.py'] = 'print(2)';
  assert.throws(() => state.readCheckpoint(changed, identity), /digest/);
  const forged = structuredClone(checkpoint);
  forged.payload.audit.push({ revision: 'next', role: 'repair' });
  assert.throws(() => state.readCheckpoint(forged, identity), /digest/);
});
