import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verify } from './criteria.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [patchPath, ...checks] = process.argv.slice(2);
const expectedChecks = (await readFile(new URL('./check.txt', import.meta.url), 'utf8')).trim().split(/\r?\n/);
assert.deepEqual(checks, expectedChecks, 'Expected the approved Trail Desk checks');
assert.ok(patchPath, 'Supply an unapplied patch');
const patch = resolve(patchPath);
const patchStat = await lstat(patch);
assert.ok(patchStat.isFile() && patchStat.size > 0, 'Expected a nonempty patch file');

execFileSync('git', ['apply', '--check', '--', patch], { cwd: root });
const paths = expectedChecks.includes('trail-desk.miles') ?
  ['src/index.html'] : ['src/index.html', 'src/server.mjs', 'src/catalog.json'];
const records = execFileSync('git', ['apply', '--numstat', '-z', '--', patch], { cwd: root, encoding: 'utf8' })
  .split('\0').slice(0, -1);
assert.ok(records.length > 0 && records.every(record => {
  const path = /^(?:\d+|-)\t(?:\d+|-)\t([^\r\n\t]+)$/.exec(record)?.[1];
  return paths.includes(path);
}), 'Patch must stay within the approved Trail Desk application paths');

const directory = await mkdtemp(join(tmpdir(), 'forge-trail-desk-check-'));
let server;
let browser;
try {
  await cp(join(root, 'src'), join(directory, 'src'), { recursive: true });
  execFileSync('git', ['apply', '--', patch], { cwd: directory });
  const sourceFiles = ['src/index.html', 'src/server.mjs'];
  if (paths.includes('src/catalog.json')) sourceFiles.push('src/catalog.json');
  for (const file of sourceFiles) {
    assert.ok((await lstat(join(directory, file))).isFile(), 'Expected a regular source file: ' + file);
  }
  assert.ok(process.env.FORGE_PLAYWRIGHT, 'Set FORGE_PLAYWRIGHT to Playwright index.mjs');
  const { chromium } = await import(pathToFileURL(resolve(process.env.FORGE_PLAYWRIGHT)).href);

  server = spawn(process.execPath, ['src/server.mjs'], { cwd: directory, env: {}, stdio: ['ignore', 'pipe', 'ignore'] });
  const lines = createInterface({ input: server.stdout });
  const port = await Promise.race([
    once(lines, 'line', { signal: AbortSignal.timeout(5000) }).then(([line]) => line),
    once(server, 'exit').then(() => { throw new Error('Trail Desk exited before serving HTTP'); }),
  ]);
  assert.match(port, /^[1-9][0-9]{0,4}$/, 'Expected a loopback port');
  const origin = 'http://127.0.0.1:' + port;

  browser = await chromium.launch();
  const page = await browser.newPage({ serviceWorkers: 'block' });
  page.setDefaultTimeout(5000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  const readFixture = async name => JSON.parse(await readFile(join(root, name)));
  const [acceptance, catalog] = await Promise.all(['acceptance.json', 'catalog.json'].map(readFixture));
  const observations = await verify({ page, origin, acceptance, catalog });
  console.log(JSON.stringify({ checks: expectedChecks, observations }));
} finally {
  try {
    await browser?.close();
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      const stopped = once(server, 'exit');
      server.kill('SIGKILL');
      await stopped;
    }
    await rm(directory, { recursive: true, force: true });
  }
}
