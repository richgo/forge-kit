import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createPromotion, scanSources, summarizeRuntime, validatePromotion } from '../factory/supply-chain.mjs';

const image = 'docker.io/library/node@sha256:' + 'a'.repeat(64);
const source = 'b'.repeat(40);
const asBytes = value => Buffer.from(JSON.stringify(value));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const now = new Date('2026-11-09T12:00:00Z');
const bundle = {
  product: 'example', source,
  candidates: { initial: { candidate: { 'src/entry.mjs': 'console.log("a");' } },
    next: { candidate: { 'src/entry.mjs': 'console.log("b");' } } },
  evidence: { initial: { acceptance: { passed: true } }, next: { acceptance: { passed: true } } },
};

function imageScan() {
  return {
    SchemaVersion: 2, ArtifactType: 'container_image',
    Metadata: { ImageID: 'sha256:' + 'c'.repeat(64), RepoDigests: ['node@' + image.split('@')[1]],
      OS: { Family: 'debian', Name: '13.0' } },
    Results: [{ Class: 'os-pkgs', Target: 'debian',
      Packages: [{ Name: 'ca-certificates', Version: '1.0' }],
      Vulnerabilities: [
        { VulnerabilityID: 'CVE-2026-0001', PkgName: 'glibc', InstalledVersion: '1.0', Severity: 'HIGH', FixedVersion: '2.0' },
        { VulnerabilityID: 'CVE-2026-0002', PkgName: 'gzip', InstalledVersion: '1.0', Severity: 'CRITICAL', FixedVersion: '' },
      ] }],
  };
}

function inputs() {
  const bundleBytes = asBytes(bundle);
  const sourceComponents = ['initial', 'next'].map(revision => ({
    type: 'file', name: revision + '/src/entry.mjs',
    hashes: [{ alg: 'SHA-256', content: digest(bundle.candidates[revision].candidate['src/entry.mjs']) }],
  }));
  return {
    bundleBytes, lockBytes: Buffer.from('immutable-commit\n'), image,
    reportBytes: asBytes({
      schemaVersion: 1, scanner: { name: 'trivy', version: '0.76.2' },
      bundleSha256: digest(bundleBytes), image, platform: 'linux/amd64',
      secrets: { count: 0 },
      database: { updatedAt: '2026-11-09T00:00:00Z', sha256: 'd'.repeat(64) },
      runtime: summarizeRuntime(imageScan(), image),
    }),
    sbomBytes: asBytes({
      bomFormat: 'CycloneDX', specVersion: '1.6', metadata: { component: { type: 'container', name: image } },
      components: [{ type: 'library', name: 'ca-certificates' }, ...sourceComponents],
    }),
  };
}

test('a signed promotion can only authorize the exact bundle, lock, SBOM, and security evidence', () => {
  const evidence = inputs();
  const manifest = createPromotion(evidence, now);
  assert.equal(manifest.bundleSha256, digest(evidence.bundleBytes));
  assert.equal(manifest.sourceLockSha256, digest(evidence.lockBytes));
  assert.equal(manifest.securityReportSha256, digest(evidence.reportBytes));
  assert.equal(manifest.sbomSha256, digest(evidence.sbomBytes));
  assert.doesNotThrow(() => validatePromotion(manifest, evidence, now));
  for (const field of ['bundleBytes', 'lockBytes', 'reportBytes', 'sbomBytes']) {
    const changed = { ...evidence, [field]: Buffer.concat([evidence[field], Buffer.from('\n')]) };
    assert.throws(() => validatePromotion(manifest, changed, now), /digest|promotion/i);
  }
});

test('a missing or stale scanner result blocks promotion', () => {
  const evidence = inputs();
  assert.throws(() => createPromotion({ ...evidence, reportBytes: undefined }, now), /security report/i);
  assert.throws(() => createPromotion(evidence, new Date('2026-11-13T12:00:00Z')), /stale/i);
  const scan = imageScan();
  scan.Results[0].Packages = [];
  assert.throws(() => summarizeRuntime(scan, image), /package/i);
  scan.Results[0].Packages = [{ Name: 'pkg', Version: '1' }];
  scan.Metadata.RepoDigests = ['node@sha256:' + 'f'.repeat(64)];
  assert.throws(() => summarizeRuntime(scan, image), /image digest/i);
});

test('a found secret and a critical vulnerability with a fix block signing', () => {
  const evidence = inputs();
  const report = JSON.parse(evidence.reportBytes);
  report.secrets.count = 1;
  assert.throws(() => createPromotion({ ...evidence, reportBytes: asBytes(report) }, now), /secret/i);
  report.secrets.count = 0;
  report.runtime.vulnerabilities.find(item => item.id === 'CVE-2026-0002').fixed = '1.1';
  assert.throws(() => createPromotion({ ...evidence, reportBytes: asBytes(report) }, now), /critical/i);
});

test('SBOM includes the full runtime and exact candidate files', () => {
  const evidence = inputs();
  const sbom = JSON.parse(evidence.sbomBytes);
  sbom.components[1].hashes[0].content = 'e'.repeat(64);
  assert.throws(() => createPromotion({ ...evidence, sbomBytes: asBytes(sbom) }, now), /source digest/i);
  sbom.components = sbom.components.slice(1);
  assert.throws(() => createPromotion({ ...evidence, sbomBytes: asBytes(sbom) }, now), /runtime packages/i);
});

if (process.env.FORGE_TEST_TRIVY) {
  test('the pinned real scanner catches a synthetic GitHub credential without exposing it', async () => {
    const generated = ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('_');
    const checkpoint = { schemaVersion: 1, identity: {}, payload: { audit: [],
      candidate: { candidate: { 'src/entry.mjs': 'const api = "' + generated + '";' } } },
    payloadSha256: 'f'.repeat(64) };
    assert.deepEqual(await scanSources({ bytes: asBytes(bundle), executable: process.env.FORGE_TEST_TRIVY }), { count: 0 });
    const scan = await scanSources({ bytes: asBytes(checkpoint), executable: process.env.FORGE_TEST_TRIVY });
    assert.ok(scan.count > 0);
    assert.ok(!JSON.stringify(scan).includes(generated));
  });
}
