import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');

export function createRelease({ artifact, report, receipt }, source) {
  assert.ok(typeof source === 'string' && /^[a-f0-9]{40}$/.test(source) && source.length === 40);
  assert.match(report.requirementsSha256, /^[a-f0-9]{64}$/);
  assert.equal(digest(artifact), report.artifactSha256, 'Candidate digest mismatch');
  assert.deepEqual(receipt.subject, [{ name: 'deployed.mjs', digest: { sha256: report.artifactSha256 } }]);
  const requirementsSource = report.requirements ? 'product-requirements.md' : 'product-requirements.json';
  assert.deepEqual(receipt.predicate.materials.filter(material => material.name === requirementsSource),
    [{ name: requirementsSource, digest: { sha256: report.requirementsSha256 } }]);
  if (report.requirements) {
    const { sourceSha256, acceptanceSha256, normalizedSha256, compiler } = report.requirements;
    assert.equal(receipt.predicateType, 'https://github.com/richgo/forge-kit/attestations/bootstrap/v4');
    assert.equal(sourceSha256, report.requirementsSha256);
    assert.match(acceptanceSha256, /^[a-f0-9]{64}$/);
    assert.match(normalizedSha256, /^[a-f0-9]{64}$/);
    assert.equal(compiler, 'forgekit-requirements/markdown-v1');
    assert.deepEqual(receipt.predicate.requirements, report.requirements);
    assert.deepEqual(receipt.predicate.materials.filter(material => material.name === 'acceptance.json'),
      [{ name: 'acceptance.json', digest: { sha256: acceptanceSha256 } }]);
  }
  assert.deepEqual(receipt.predicate.trace, report.trace);
  const { epic, feature, story, criteria } = report.trace;
  assert.equal(receipt.predicate.requirement, story);
  assert.match(epic, /^EPIC-[0-9]+$/);
  assert.match(feature, /^FEAT-[0-9]+$/);
  assert.match(story, /^STORY-[0-9]+$/);
  const observation = receipt.predicate.observation;
  for (const { id, then } of criteria) {
    assert.match(id, /^AC-[0-9]+$/);
    for (const [key, value] of Object.entries(then)) {
      assert.equal(observation[key], key === 'stdout' ? value + '\n' : value, id + ' failed');
    }
  }
  assert.ok(criteria.length > 0);
  assert.equal(observation.exitCode, 0);
  assert.match(observation.stdout, /^[a-z]{1,32}\n$/);
  const status = observation.stdout.trim();
  const proof = {
    source, epic, feature, story, status, acceptance: criteria.map(item => item.id),
    requirementsSha256: report.requirementsSha256, artifactSha256: report.artifactSha256,
    ...(report.requirements && { requirements: report.requirements }),
  };
  const release = digest(JSON.stringify(proof));
  const html = [
    '<!doctype html>',
    '<html lang="en"><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Forge Kit release drill</title>',
    '<main><h1>Forge Kit release drill</h1>',
    '<p>Story ' + story + ' reported <strong>' + status + '</strong>.</p>',
    '<p>Release <code>' + release + '</code></p>',
    '<p><a href="release.json">View release evidence</a></p></main></html>',
    '',
  ].join('\n');
  return { html, manifest: { ...proof, release, indexSha256: digest(html) } };
}

export async function checkPublished(pageUrl, expected, send = fetch) {
  const root = new URL(pageUrl);
  assert.equal(root.protocol, 'https:');
  assert.equal(root.username + root.password + root.search + root.hash, '');
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  const get = async path => {
    const url = new URL(path, root);
    url.searchParams.set('probe', expected.release + '-' + Date.now());
    const response = await send(url, {
      headers: { 'Cache-Control': 'no-cache' },
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
    });
    assert.ok(response.ok, 'Pages returned HTTP ' + response.status);
    return response;
  };
  assert.deepEqual(await (await get('release.json')).json(), expected, 'Published release mismatch');
  const html = Buffer.from(await (await get('index.html')).arrayBuffer());
  assert.equal(digest(html), expected.indexSha256, 'Published HTML digest mismatch');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [command, first, second, source] = process.argv.slice(2);
  if (command === 'package' && first && second && source) {
    const [artifact, report, receipt] = await Promise.all(['deployed.mjs', 'requirements-verification.json', 'receipt.json']
      .map(name => readFile(join(first, name))));
    const { html, manifest } = createRelease({ artifact, report: JSON.parse(report), receipt: JSON.parse(receipt) }, source);
    await mkdir(second);
    await writeFile(join(second, 'index.html'), html);
    await writeFile(join(second, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  } else if (command === 'probe' && first && second && !source) {
    const expected = JSON.parse(await readFile(second));
    for (let attempt = 1; ; attempt++) {
      try {
        await checkPublished(first, expected);
        break;
      } catch (error) {
        if (attempt === 12) throw error;
        await delay(5000);
      }
    }
    console.log(JSON.stringify({ url: first, ...expected, observed: 'passed' }));
  } else {
    throw new Error('Usage: pages.mjs package RUN_DIR SITE_DIR COMMIT | probe PAGE_URL RELEASE_JSON');
  }
}
