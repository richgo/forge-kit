import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';
import { bindApmxEvidence } from './apmx-evidence.mjs';

const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const packageRef = 'richgo/forge-kit-skills/packages/software-factory#89eed7bdb145e8ec64ba08091968558cfee97daa';
const signer = 'danielmeppiel/apmx/.github/workflows/run.yml';
const signerRef = 'fae2067a0dc6ff07beda714015ff9e648f41ce63';
const { values } = parseArgs({ options: Object.fromEntries(
  ['plan', 'unit', 'receipt', 'delivery', 'source', 'ref', 'gh'].map(key => [key, { type: 'string' }]),
) });

async function inventory(directory, prefix = '', files = Object.create(null)) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const entry = await lstat(path);
    const key = prefix + name;
    if (entry.isDirectory()) await inventory(path, key + '/', files);
    else {
      assert.ok(entry.isFile(), 'Invalid delivery file ' + key);
      files[key] = hash(await readFile(path));
    }
  }
  return files;
}

try {
  const plan = JSON.parse(await readFile(values.plan));
  const { sha256, ...body } = plan;
  assert.equal(sha256, hash(JSON.stringify(body)), 'Product plan digest mismatch');
  const receipt = await readFile(values.receipt);
  const delivered = await inventory(values.delivery);
  assert.match(values.source, /^[0-9a-f]{40}$/, 'Expected exact orchestration workflow source commit');
  assert.match(values.ref, /^refs\/(?:heads|tags)\/[a-zA-Z0-9_./-]+$/, 'Expected reviewed workflow ref');
  const sample = Object.keys(delivered).sort()[0];
  assert.ok(sample, 'Delivery is empty');
  const { stdout } = await execute(values.gh || 'gh', ['attestation', 'verify', resolve(values.delivery, sample),
    '--repo', 'richgo/forge-kit', '--signer-workflow', signer, '--signer-digest', signerRef,
    '--source-ref', values.ref, '--source-digest', values.source,
    '--predicate-type', 'https://github.com/danielmeppiel/apmx/attestation/receipt-bundle/v2', '--format', 'json'],
  { timeout: 60_000, maxBuffer: 12 * 1024 * 1024 });
  const attestations = JSON.parse(stdout);
  const errors = [];
  for (const result of attestations) {
    try {
      const predicate = result.verificationResult.statement.predicate;
      console.log(JSON.stringify(bindApmxEvidence(plan, values.unit, receipt, predicate, delivered, packageRef)));
      break;
    } catch (error) {
      errors.push(error.message);
    }
  }
  assert.ok(attestations.length > errors.length, 'No verified attestation matched the unit: ' + errors.join('. '));
} catch (error) {
  console.error('APMX evidence authentication failed. ' + error.message);
  process.exitCode = 1;
}
