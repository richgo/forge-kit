import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify, parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { STAGES, verifyStageChain } from './stage-chain.mjs';

const execute = promisify(execFile);
export const PREDICATE_TYPE = 'https://github.com/richgo/forge-kit/attestations/stage-receipt/v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Trust configuration comes from the reviewed orchestrator, never from a receipt.
// gh validates Sigstore/in-toto signatures, subject bytes and GitHub OIDC identity.
export async function authenticateStageChain({ directory, trust, approvedBase, releaseDigest,
  run = execute }) {
  assert.match(trust.repository, /^[\w.-]+\/[\w.-]+$/);
  assert.match(trust.sourceDigest, /^[a-f0-9]{40}$/);
  assert.match(trust.sourceRef, /^refs\/(heads|tags)\/[\w./-]+$/);
  assert.match(trust.runId, /^[1-9][0-9]*$/);
  assert.match(trust.runAttempt, /^[1-9][0-9]*$/);
  assert.deepEqual(Object.keys(trust.stages).sort(), [...STAGES].sort(), 'All stage trust identities required');
  const chain = [];
  const authenticated = new Set();
  for (const name of STAGES) {
    const identity = trust.stages[name];
    assert.match(identity.workflow, /^[\w.-]+\/[\w.-]+\/\.github\/workflows\/[\w.-]+\.ya?ml$/);
    assert.match(identity.digest, /^[a-f0-9]{40}$/);
    const file = resolve(directory, name + '.json');
    const bytes = await readFile(file);
    const receipt = JSON.parse(bytes);
    assert.equal(receipt.name, name);
    assert.equal(receipt.runId, trust.runId, 'Stale workflow run');
    assert.equal(receipt.runAttempt, trust.runAttempt, 'Stale workflow attempt');
    const { stdout } = await run('gh', ['attestation', 'verify', file,
      '--bundle', resolve(directory, name + '.sigstore.json'),
      '--repo', trust.repository, '--signer-workflow', identity.workflow,
      '--signer-digest', identity.digest, '--source-ref', trust.sourceRef,
      '--source-digest', trust.sourceDigest, '--deny-self-hosted-runners',
      '--predicate-type', PREDICATE_TYPE, '--format', 'json'],
    { timeout: 60_000, maxBuffer: 12 * 1024 * 1024 });
    const results = JSON.parse(stdout);
    assert.ok(Array.isArray(results) && results.some(result => {
      const statement = result.verificationResult?.statement;
      return statement?._type === 'https://in-toto.io/Statement/v1' &&
        statement.predicateType === PREDICATE_TYPE &&
        statement.subject?.length === 1 && statement.subject[0].digest?.sha256 === sha(bytes) &&
        statement.predicate?.receiptDigest === receipt.receiptDigest &&
        statement.predicate?.runId === trust.runId &&
        statement.predicate?.runAttempt === trust.runAttempt;
    }), 'Verified attestation does not bind the stage receipt');
    chain.push(receipt);
    authenticated.add(receipt);
  }
  return verifyStageChain(chain, { approvedBase, releaseDigest,
    authenticated: receipt => authenticated.has(receipt) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: Object.fromEntries(
      ['directory', 'trust', 'approved-base', 'release-digest'].map(key => [key, { type: 'string' }])) });
    const result = await authenticateStageChain({ directory: values.directory,
      trust: JSON.parse(await readFile(values.trust)), approvedBase: values['approved-base'],
      releaseDigest: values['release-digest'] });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error('Stage authentication failed: ' + error.message);
    process.exitCode = 1;
  }
}
