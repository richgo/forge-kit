import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
const hex = /^[a-f0-9]{64}$/;
export const STAGES = Object.freeze(['admit', 'plan', 'specify', 'build', 'review', 'qualify']);

// This verifier does NOT authenticate signatures. The caller must authenticate each
// in-toto statement against its trusted signer/workflow before calling this function.
export function verifyStageChain(chain, { approvedBase, releaseDigest, authenticated }) {
  assert.ok(Array.isArray(chain) && chain.length === STAGES.length, 'Complete stage chain required');
  assert.ok(typeof authenticated === 'function', 'Independent signature authentication required');
  assert.ok(hex.test(approvedBase ?? '') && hex.test(releaseDigest ?? ''), 'Invalid approved base or release digest');
  let predecessor = null;
  let expectedInput = approvedBase;
  const seen = new Set();
  for (let i = 0; i < STAGES.length; i++) {
    const stage = chain[i];
    assert.equal(stage.name, STAGES[i], 'Missing, reordered or duplicate stage');
    assert.ok(authenticated(stage) === true, 'Stage signature or signer identity not authenticated: ' + stage.name);
    assert.ok(hex.test(stage.inputDigest ?? '') && hex.test(stage.outputDigest ?? '') &&
      hex.test(stage.evidenceDigest ?? ''), 'Invalid stage digest');
    assert.equal(stage.inputDigest, expectedInput, 'Stage input is not bound to predecessor');
    assert.equal(stage.predecessor ?? null, predecessor, 'Stage predecessor receipt mismatch');
    assert.equal(stage.verification?.passed, true, 'Independent verification did not pass');
    assert.equal(stage.verification?.independent, true, 'Producer cannot self-approve stage');
    assert.equal(stage.policy?.allowed, true, 'Stage policy did not authorize advancement');
    assert.ok(typeof stage.receiptDigest === 'string' && hex.test(stage.receiptDigest), 'Invalid receipt digest');
    const { receiptDigest, ...receipt } = stage;
    assert.equal(receiptDigest, sha(JSON.stringify(receipt)), 'Stage receipt was modified');
    assert.ok(!seen.has(receiptDigest), 'Duplicate receipt');
    seen.add(receiptDigest);
    predecessor = receiptDigest;
    expectedInput = stage.outputDigest;
  }
  assert.equal(expectedInput, releaseDigest, 'Release digest differs from qualified output');
  return { passed: true, releaseDigest, finalReceiptDigest: predecessor, stages: STAGES.length };
}
