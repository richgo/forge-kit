import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex256 = /^[a-f0-9]{64}$/;

export function createCheckpoint(identity, candidate, audit) {
  assert.match(identity.source, /^[a-f0-9]{40}$/);
  assert.match(identity.run, /^[1-9][0-9]*$/);
  assert.match(identity.product, /^[a-z][a-z0-9-]*$/);
  assert.match(identity.requirementsSha256, hex256);
  assert.match(identity.capabilityLockSha256, hex256);
  assert.ok(Array.isArray(audit) && audit.length > 0 && audit.length <= 20 &&
    audit.every(event => event.revision === 'initial'), 'Invalid initial audit');
  const payload = { candidate, audit };
  return { schemaVersion: 1, identity, payload, payloadSha256: hash(payload) };
}

export function readCheckpoint(checkpoint, identity) {
  assert.equal(checkpoint?.schemaVersion, 1, 'Unknown checkpoint schema');
  assert.deepEqual(checkpoint.identity, identity, 'Checkpoint identity mismatch');
  assert.equal(checkpoint.payloadSha256, hash(checkpoint.payload), 'Checkpoint payload digest mismatch');
  const { candidate, audit } = checkpoint.payload;
  createCheckpoint(identity, candidate, audit);
  return { candidate, audit };
}
