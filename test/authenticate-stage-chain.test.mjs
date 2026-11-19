import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { test } from 'node:test';
import { authenticateStageChain, PREDICATE_TYPE } from '../factory/authenticate-stage-chain.mjs';
import { STAGES } from '../factory/stage-chain.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'stage-auth-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const trust = { repository: 'richgo/forge-kit', sourceDigest: 'a'.repeat(40),
    sourceRef: 'refs/heads/main', runId: '123', runAttempt: '2', stages: {} };
  const receipts = {};
  let inputDigest = sha('approved');
  let predecessor = null;
  for (const name of STAGES) {
    trust.stages[name] = { workflow: 'richgo/forge-kit/.github/workflows/stage.yml', digest: 'b'.repeat(40) };
    const receipt = { name, inputDigest, outputDigest: sha(name), evidenceDigest: sha(name + '-evidence'),
      predecessor, runId: trust.runId, runAttempt: trust.runAttempt,
      verification: { passed: true, independent: true }, policy: { allowed: true } };
    receipt.receiptDigest = sha(JSON.stringify(receipt));
    const bytes = JSON.stringify(receipt);
    await writeFile(join(directory, name + '.json'), bytes);
    receipts[name] = { receipt, bytes };
    inputDigest = receipt.outputDigest;
    predecessor = receipt.receiptDigest;
  }
  const calls = [];
  const run = async (command, args) => {
    calls.push({ command, args });
    const { receipt, bytes } = receipts[basename(args[2], '.json')];
    return { stdout: JSON.stringify([{ verificationResult: { statement: {
      _type: 'https://in-toto.io/Statement/v1', predicateType: PREDICATE_TYPE,
      subject: [{ name: receipt.name + '.json', digest: { sha256: sha(bytes) } }],
      predicate: { receiptDigest: receipt.receiptDigest, runId: trust.runId, runAttempt: trust.runAttempt },
    } } }]) };
  };
  return { directory, trust, approvedBase: sha('approved'), releaseDigest: inputDigest, run, receipts, calls };
}
test('authenticates every receipt with pinned workflow, source and offline bundle', async t => {
  const f = await fixture(t);
  assert.equal((await authenticateStageChain(f)).stages, 6);
  assert.equal(f.calls.length, 6);
  for (const { command, args } of f.calls) {
    assert.equal(command, 'gh');
    for (const flag of ['--bundle', '--signer-workflow', '--signer-digest', '--source-ref',
      '--source-digest', '--deny-self-hosted-runners', '--predicate-type']) assert.ok(args.includes(flag));
  }
});
test('rejects signature failure and never trusts receipt authentication claims', async t => {
  const f = await fixture(t);
  f.run = async () => { throw new Error('untrusted signer'); };
  await assert.rejects(authenticateStageChain(f), /untrusted signer/);
});
test('rejects swapped artifact despite successful signature command', async t => {
  const f = await fixture(t);
  const run = f.run;
  f.run = async (...args) => {
    const output = JSON.parse((await run(...args)).stdout);
    output[0].verificationResult.statement.subject[0].digest.sha256 = sha('swapped');
    return { stdout: JSON.stringify(output) };
  };
  await assert.rejects(authenticateStageChain(f), /does not bind/);
});
test('rejects replay from a previous run or attempt before signature verification', async t => {
  for (const key of ['runId', 'runAttempt']) {
    const f = await fixture(t);
    f.trust[key] = '999';
    await assert.rejects(authenticateStageChain(f), /Stale workflow/);
    assert.equal(f.calls.length, 0);
  }
});
test('rejects missing stage file and mismatched attested predicate', async t => {
  const f = await fixture(t);
  await rm(join(f.directory, 'qualify.json'));
  await assert.rejects(authenticateStageChain(f), /ENOENT/);
  const g = await fixture(t);
  const run = g.run;
  g.run = async (...args) => {
    const output = JSON.parse((await run(...args)).stdout);
    output[0].verificationResult.statement.predicate.receiptDigest = sha('wrong');
    return { stdout: JSON.stringify(output) };
  };
  await assert.rejects(authenticateStageChain(g), /does not bind/);
});
