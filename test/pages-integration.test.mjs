import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { checkPublished } from '../factory/pages.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function releaseFixture() {
  const html = Buffer.from('<!doctype html><title>verified release</title>\n');
  const manifest = {
    source: 'a'.repeat(40),
    release: 'b'.repeat(64),
    indexSha256: sha256(html),
  };
  return { html, manifest };
}

test('hosted release probe fetches exactly the release manifest and page with cache bypass', async () => {
  const { html, manifest } = releaseFixture();
  const requested = [];
  const send = async (url, options) => {
    requested.push({ url: new URL(url), options });
    return new Response(url.pathname.endsWith('/release.json') ? JSON.stringify(manifest) : html);
  };
  await checkPublished('https://example.test/forge-kit', manifest, send);
  assert.deepEqual(requested.map(x => x.url.pathname),
    ['/forge-kit/release.json', '/forge-kit/index.html']);
  for (const { url, options } of requested) {
    assert.equal(url.searchParams.has('probe'), true);
    assert.match(url.searchParams.get('probe'), /^b{64}-[0-9]+$/);
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
  }
});

test('hosted release probe rejects insecure, credentialed and query-bearing URLs before network access', async () => {
  const { manifest } = releaseFixture();
  const send = () => { throw new Error('Network must not be reached'); };
  for (const url of [
    'http://example.test/forge-kit/',
    'https://user:password@example.test/forge-kit/',
    'https://example.test/forge-kit/?override=1',
    'https://example.test/forge-kit/#fragment',
  ]) {
    await assert.rejects(checkPublished(url, manifest, send));
  }
});

test('hosted release probe fails closed on HTTP errors and a mismatched manifest', async () => {
  const { html, manifest } = releaseFixture();
  await assert.rejects(
    checkPublished('https://example.test/forge-kit/', manifest,
      async () => new Response('unavailable', { status: 503 })),
    /HTTP 503/
  );
  await assert.rejects(
    checkPublished('https://example.test/forge-kit/', manifest,
      async url => new Response(url.pathname.endsWith('release.json')
        ? JSON.stringify({ ...manifest, release: 'c'.repeat(64) }) : html)),
    /Published release mismatch/
  );
});

test('hosted release probe rejects a changed index even if the release manifest is unchanged', async () => {
  const { manifest } = releaseFixture();
  await assert.rejects(
    checkPublished('https://example.test/forge-kit/', manifest,
      async url => new Response(url.pathname.endsWith('release.json')
        ? JSON.stringify(manifest) : '<!doctype html><title>tampered</title>')),
    /Published HTML digest mismatch/
  );
});
