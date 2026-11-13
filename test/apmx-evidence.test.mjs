import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { bindApmxEvidence } from '../factory/apmx-evidence.mjs';

const revision = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const factory = 'org/catalog/packages/factory#' + revision;
const plan = { sha256: digest, waves: [['api']], units: {
  api: { source: { repository: 'org/api', path: 'services/api', revision } },
} };
const subject = [{ name: 'app.py', digest: { sha256: digest } }];
const provenance = { predicateType: 'https://slsa.dev/provenance/v1', subject,
  predicate: { buildDefinition: {
    externalParameters: { factory: { package: factory } },
    resolvedDependencies: [{ annotations: { 'apmx.role': 'base' }, digest: { gitCommit: revision },
      uri: 'git+https://github.com/org/api@' + revision }],
  } } };
const testResult = { predicateType: 'https://in-toto.io/attestation/test-result/v0.1', subject,
  predicate: { result: 'PASSED', configuration: [{ annotations: { stage: 'build', check: 'project-acceptance' } }] } };
const encode = lines => Buffer.from(lines.map(statement => JSON.stringify({
  payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
})).join('\n') + '\n');
const lines = [provenance, testResult];
const bytes = encode(lines);
const delivered = { 'services/api/app.py': digest };

test('binds verified statements and delivered bytes to one implementation unit', () => {
  const result = bindApmxEvidence(plan, 'api', bytes, { lines }, delivered, factory);
  assert.equal(result.sourceRevision, revision);
  assert.equal(result.receiptSha256, createHash('sha256').update(bytes).digest('hex'));
});

test('rejects swapped receipts, missing checks and altered deliveries', () => {
  assert.throws(() => bindApmxEvidence(plan, 'api', bytes, { lines: [provenance] }, delivered, factory),
    /signed bundle/);
  assert.throws(() => bindApmxEvidence(plan, 'api', encode([provenance]), { lines: [provenance] }, delivered, factory),
    /independent project acceptance/);
  assert.throws(() => bindApmxEvidence(plan, 'api', bytes, { lines }, { 'services/api/app.py': revision }, factory),
    /delivered bytes/i);
});
