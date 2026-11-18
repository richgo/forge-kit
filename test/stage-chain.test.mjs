import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { STAGES, verifyStageChain } from '../factory/stage-chain.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(value);
function fixture() {
  let input = digest('approved-base');
  let predecessor = null;
  const chain = STAGES.map(name => {
    const stage = { name, inputDigest: input, outputDigest: digest(name),
      evidenceDigest: digest(name + '-evidence'), predecessor,
      verification: { passed: true, independent: true }, policy: { allowed: true } };
    stage.receiptDigest = digest(JSON.stringify(stage));
    input = stage.outputDigest;
    predecessor = stage.receiptDigest;
    return stage;
  });
  return { chain, approvedBase: digest('approved-base'), releaseDigest: input,
    authenticated: () => true };
}
test('accepts a complete independently authenticated and verified stage chain', () => {
  assert.equal(verifyStageChain(fixture()).stages, 6);
});
test('rejects omitted and reordered stages', () => {
  const x = fixture(); x.chain.splice(2, 1);
  assert.throws(() => verifyStageChain(x), /Complete stage chain/);
  const y = fixture(); [y.chain[1], y.chain[2]] = [y.chain[2], y.chain[1]];
  assert.throws(() => verifyStageChain(y), /stage/i);
});
test('rejects forged authentication and self-verification', () => {
  const x = fixture(); x.authenticated = () => false;
  assert.throws(() => verifyStageChain(x), /authenticated/);
  const y = fixture(); y.chain[2].verification.independent = false;
  assert.throws(() => verifyStageChain(y), /self-approve/);
});
test('rejects altered evidence, broken links, denied policy and mismatched release', () => {
  const x = fixture(); x.chain[3].evidenceDigest = digest('swapped');
  assert.throws(() => verifyStageChain(x), /modified/);
  const y = fixture(); y.chain[4].predecessor = digest('wrong');
  assert.throws(() => verifyStageChain(y), /predecessor/);
  const z = fixture(); z.chain[1].policy.allowed = false;
  assert.throws(() => verifyStageChain(z), /policy/);
  const w = fixture(); w.releaseDigest = digest('other');
  assert.throws(() => verifyStageChain(w), /Release digest/);
});
