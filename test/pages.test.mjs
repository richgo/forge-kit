import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { checkPublished, createRelease } from '../factory/pages.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(output = 'ready') {
  const artifact = Buffer.from('fixture:' + output);
  const trace = {
    epic: 'EPIC-001', feature: 'FEAT-001', story: 'STORY-001', node: 'health_probe',
    criteria: [{ id: 'AC-001', when: 'run-readiness-probe', then: { stdout: output } },
      { id: 'AC-002', when: 'run-readiness-probe', then: { exitCode: 0 } }],
  };
  const report = { trace, requirementsSha256: digest(output), artifactSha256: digest(artifact) };
  const receipt = {
    subject: [{ name: 'deployed.mjs', digest: { sha256: report.artifactSha256 } }],
    predicate: {
      requirement: trace.story, trace,
      materials: [{ name: 'product-requirements.json', digest: { sha256: report.requirementsSha256 } }],
      observation: { stdout: output + '\n', exitCode: 0 },
    },
  };
  return { artifact, report, receipt };
}

test('release exposes the verified story and changes identity when the candidate changes', () => {
  const baseline = createRelease(fixture(), 'a'.repeat(40));
  const next = createRelease(fixture('healthy'), 'a'.repeat(40));
  assert.equal(baseline.manifest.story, 'STORY-001');
  assert.equal(baseline.manifest.status, 'ready');
  assert.deepEqual(baseline.manifest.acceptance, ['AC-001', 'AC-002']);
  assert.notEqual(baseline.manifest.release, next.manifest.release);
  assert.equal(baseline.manifest.indexSha256, digest(baseline.html));
});

test('release refuses an altered candidate or inconsistent proof', () => {
  const input = fixture();
  assert.throws(() => createRelease({ ...input, artifact: Buffer.from('changed') }, 'a'.repeat(40)), /digest/);
  input.receipt.predicate.observation.stdout = 'broken\n';
  assert.throws(() => createRelease(input, 'a'.repeat(40)), /AC-001/);
});

test('live probe detects the wrong release and a tampered page', async () => {
  const baseline = createRelease(fixture(), 'a'.repeat(40));
  const next = createRelease(fixture('healthy'), 'a'.repeat(40));
  const send = (release, html = release.html) => async url => new Response(
    new URL(url).pathname.endsWith('/release.json') ? JSON.stringify(release.manifest) : html
  );
  const url = 'https://richgo.github.io/forge-kit/';
  await checkPublished(url, baseline.manifest, send(baseline));
  await assert.rejects(checkPublished(url, baseline.manifest, send(next)), /Published release/);
  await assert.rejects(checkPublished(url, baseline.manifest, send(baseline, '<h1>changed</h1>')), /HTML digest/);
});
