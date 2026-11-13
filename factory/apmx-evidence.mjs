import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const hex = /^[a-f0-9]{64}$/;
const provenance = 'https://slsa.dev/provenance/v1';
const testResult = 'https://in-toto.io/attestation/test-result/v0.1';

// The caller verifies the GitHub bundle's signature and trusted workflow/source identity
// before passing its decoded predicate. This function binds the authenticated data to the plan.
export function bindApmxEvidence(plan, unitId, receiptBytes, signedPredicate, delivered, factory) {
  const unit = plan.units[unitId];
  assert.ok(unit && plan.waves.flat().includes(unitId), 'Unknown or unaffected implementation unit');
  const statements = receiptBytes.toString('utf8').trim().split(/\r?\n/).map(line => {
    const envelope = JSON.parse(line);
    return JSON.parse(Buffer.from(envelope.payload, 'base64'));
  });
  assert.deepEqual(signedPredicate?.lines, statements, 'Receipt statements differ from the signed bundle');
  const builds = statements.filter(statement => statement.predicateType === provenance);
  assert.equal(builds.length, 1, 'Exactly one APMX provenance statement is required');
  const build = builds[0].predicate.buildDefinition;
  assert.equal(build.externalParameters.factory.package, factory, 'Unexpected APMX package identity');
  const base = build.resolvedDependencies.filter(dep => dep.annotations?.['apmx.role'] === 'base');
  assert.equal(base.length, 1, 'Exactly one APMX base is required');
  assert.equal(base[0].digest.gitCommit, unit.source.revision, 'APMX base differs from the unit baseline');
  assert.equal(base[0].uri, 'git+https://github.com/' + unit.source.repository + '@' + unit.source.revision,
    'APMX base differs from the unit repository');
  assert.ok(!base[0].annotations?.deleted?.length, 'This delivery adapter requires replacement or new files');
  const checks = statements.filter(statement => statement.predicateType === testResult);
  const accepted = checks.some(statement =>
    statement.predicate.result === 'PASSED' && isDeepStrictEqual(statement.subject, builds[0].subject) &&
    statement.predicate.configuration.some(config =>
      config.annotations?.stage === 'build' && config.annotations?.check === 'project-acceptance'));
  assert.ok(accepted && checks.every(statement => statement.predicate.result === 'PASSED'),
    'The receipt must pass independent project acceptance');
  const paths = Object.create(null);
  for (const subject of builds[0].subject) {
    const path = subject.name;
    assert.ok(typeof path === 'string' && path.split('/').every(segment =>
      /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(segment) && !segment.endsWith('.')) &&
      !Object.hasOwn(paths, path), 'Unsupported delivered subject path');
    const digest = subject.digest?.sha256;
    assert.ok(hex.test(digest ?? ''), 'Invalid delivered subject digest');
    const fullPath = unit.source.path === '.' ? path : unit.source.path + '/' + path;
    assert.ok(Object.hasOwn(delivered, fullPath) && delivered[fullPath] === digest,
      'Delivered bytes differ from signed subject ' + fullPath);
    paths[path] = digest;
  }
  assert.ok(Object.keys(paths).length > 0 && Object.keys(paths).length === Object.keys(delivered).length,
    'Delivery inventory differs from signed subjects');
  return {
    unit: unitId, sourceRevision: unit.source.revision, planSha256: plan.sha256,
    artifactSha256: sha256(JSON.stringify(Object.entries(paths).sort())),
    receiptSha256: sha256(receiptBytes), passed: true,
  };
}
