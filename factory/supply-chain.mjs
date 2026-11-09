import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const scanner = { name: 'trivy', version: '0.76.2' };
const platform = 'linux/amd64';
const severities = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const revisions = ['initial', 'next'];
const hex = /^[a-f0-9]{64}$/;
const imagePattern = /^docker\.io\/library\/(?:node|python)@sha256:[a-f0-9]{64}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => JSON.stringify(value, null, 2) + '\n';

function decode(bytes, name) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0, name + ' is required');
  try {
    return JSON.parse(bytes);
  } catch {
    throw new Error('Invalid ' + name);
  }
}

async function readBounded(path, limit = 4 * 1024 * 1024) {
  const info = await stat(path);
  assert.ok(info.isFile() && info.size > 0 && info.size <= limit, 'Missing or oversized security input');
  return readFile(path);
}

async function digestDatabase(path) {
  const info = await stat(path);
  assert.ok(info.isFile() && info.size > 0 && info.size <= 4 * 1024 * 1024 * 1024,
    'Missing or oversized vulnerability database');
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest('hex');
}

function sourceEntries(bundle) {
  const candidates = bundle?.candidates ?? (bundle?.schemaVersion === 1 && bundle?.payload?.candidate
    ? { initial: bundle.payload.candidate } : {});
  const names = Object.keys(candidates);
  assert.ok(names.length && names.every(name => revisions.includes(name)), 'Expected reviewed source revisions');
  const entries = [];
  for (const revision of names.sort()) {
    const candidate = candidates[revision]?.candidate;
    assert.ok(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'Missing candidate source');
    const paths = Object.keys(candidate).sort();
    assert.ok(paths.length > 0 && paths.length <= 32, 'Invalid source file count');
    for (const path of paths) {
      const content = candidate[path];
      assert.ok(/^src\/(?:[a-z][a-z0-9_-]*\/)*[a-z][a-z0-9_-]*\.(?:mjs|py)$/.test(path) &&
        typeof content === 'string' && Buffer.byteLength(content) <= 128 * 1024, 'Invalid candidate source');
      entries.push({ path: revision + '/' + path, content });
    }
  }
  return entries;
}

export function summarizeRuntime(report, image) {
  assert.match(image, imagePattern, 'Approved image digest required');
  assert.ok(report?.SchemaVersion === 2 && report.ArtifactType === 'container_image', 'Missing image scan result');
  const { Metadata: metadata, Results: targets } = report;
  assert.ok(Array.isArray(metadata?.RepoDigests) &&
    metadata.RepoDigests.some(value => typeof value === 'string' && value.endsWith(image.slice(image.indexOf('@')))),
  'Scanned image digest differs from approved runtime');
  assert.match(metadata.ImageID ?? '', /^sha256:[a-f0-9]{64}$/, 'Missing concrete image identity');
  assert.ok(typeof metadata.OS?.Family === 'string' && typeof metadata.OS?.Name === 'string',
    'Runtime OS coverage is missing');
  assert.ok(Array.isArray(targets) && targets.some(target => target.Class === 'os-pkgs' && target.Packages?.length),
    'Runtime OS package coverage is missing');
  const vulnerabilities = targets.flatMap(target => (target.Vulnerabilities ?? []).map(issue => ({
    target: target.Target, id: issue.VulnerabilityID, package: issue.PkgName,
    installed: issue.InstalledVersion, severity: issue.Severity, fixed: issue.FixedVersion ?? '',
  })));
  return {
    imageId: metadata.ImageID,
    os: { family: metadata.OS.Family, version: metadata.OS.Name },
    packageCount: targets.reduce((count, target) => count + (target.Packages?.length ?? 0), 0),
    vulnerabilities,
  };
}

function assertFresh(database, now) {
  assert.match(database?.sha256 ?? '', hex, 'Missing vulnerability database digest');
  const age = +now - Date.parse(database?.updatedAt);
  assert.ok(Number.isFinite(age) && age >= -10 * 60_000 && age <= 72 * 60 * 60_000,
    'Missing or stale vulnerability database');
}

export function createPromotion({ bundleBytes, lockBytes, image, reportBytes, sbomBytes }, now = new Date()) {
  assert.match(image, imagePattern, 'Approved image digest required');
  const bundle = decode(bundleBytes, 'verified bundle');
  assert.match(bundle.product ?? '', /^[a-z][a-z0-9-]*$/, 'Invalid product identity');
  assert.match(bundle.source ?? '', /^[a-f0-9]{40}$/, 'Missing reviewed source commit');
  for (const name of revisions) {
    assert.ok(bundle.candidates?.[name] && bundle.evidence?.[name]?.acceptance?.passed === true,
      'Missing independent acceptance evidence');
  }
  assert.ok(Buffer.isBuffer(lockBytes) && lockBytes.length, 'Missing frozen source lock');
  const bundleSha256 = sha256(bundleBytes);
  const report = decode(reportBytes, 'security report');
  assert.ok(report.schemaVersion === 1 && report.bundleSha256 === bundleSha256 &&
    report.image === image && report.platform === platform, 'Security report subject digest mismatch');
  assert.deepEqual(report.scanner, scanner, 'Unapproved scanner');
  assert.equal(report.secrets?.count, 0, 'Missing or unsuccessful secret scan');
  assertFresh(report.database, now);
  const runtime = report.runtime;
  assert.match(runtime?.imageId ?? '', /^sha256:[a-f0-9]{64}$/, 'Missing runtime image identity');
  assert.ok(Number.isSafeInteger(runtime.packageCount) && runtime.packageCount > 0 &&
    Array.isArray(runtime.vulnerabilities), 'Missing runtime package and vulnerability evidence');
  for (const issue of runtime.vulnerabilities) {
    assert.ok(issue?.id && issue.package && issue.installed && severities.includes(issue.severity) &&
      typeof issue.fixed === 'string', 'Malformed vulnerability finding');
    assert.ok(issue.severity !== 'CRITICAL' || !issue.fixed.trim(), 'Runtime has a critical vulnerability with a fix');
  }
  const sbom = decode(sbomBytes, 'SBOM');
  const imageComponent = sbom.metadata?.component;
  assert.ok(sbom.bomFormat === 'CycloneDX' && imageComponent?.type === 'container' &&
    typeof imageComponent.name === 'string' && imageComponent.name.endsWith(image.slice(image.indexOf('@'))) &&
    Array.isArray(sbom.components) && sbom.components.some(component => component.type !== 'file'),
  'CycloneDX SBOM is missing runtime packages');
  for (const { path, content } of sourceEntries(bundle)) {
    const components = sbom.components.filter(component => component.type === 'file' && component.name === path);
    assert.ok(components.length === 1 && components[0].hashes?.some(hash =>
      hash.alg === 'SHA-256' && hash.content === sha256(content)), 'SBOM source digest mismatch');
  }
  return {
    schemaVersion: 1, product: bundle.product, source: bundle.source, image, platform,
    bundleSha256, sourceLockSha256: sha256(lockBytes),
    securityReportSha256: sha256(reportBytes), sbomSha256: sha256(sbomBytes),
  };
}

export function validatePromotion(promotion, evidence, now) {
  assert.deepEqual(promotion, createPromotion(evidence, now), 'Signed promotion digest mismatch');
}

async function scratchScan(executable, run) {
  assert.ok(typeof executable === 'string' && executable.length, 'Pinned scanner executable required');
  const scratch = await mkdtemp(join(tmpdir(), 'forge-supply-chain-'));
  const config = join(scratch, 'config.yaml');
  const cache = join(scratch, 'cache');
  try {
    await writeFile(config, '{}\n', { flag: 'wx' });
    const scan = async (operation, args) => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        ['path', 'systemroot', 'tmp', 'temp'].includes(key.toLowerCase())));
      env.HOME = scratch;
      env.USERPROFILE = scratch;
      const networkOptions = args[0] === 'convert' ? [] : ['--skip-version-check', '--disable-telemetry'];
      try {
        await execute(resolve(executable), ['--cache-dir', cache, '--config', config,
          '--quiet', ...networkOptions, ...args], {
          cwd: scratch, env, timeout: 300_000, maxBuffer: 256 * 1024,
        });
      } catch {
        // Scanner failures can contain excerpts of inputs. Do not surface raw stdout/stderr.
        throw new Error('Pinned Trivy ' + operation + ' failed');
      }
    };
    return await run({ scratch, cache, scan });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function scanSecretInput({ scratch, scan }, bytes, auditBytes) {
  const source = join(scratch, 'source');
  await mkdir(source);
  await writeFile(join(source, 'bundle.json'), bytes, { flag: 'wx', mode: 0o600 });
  if (auditBytes) await writeFile(join(source, 'audit.jsonl'), auditBytes, { flag: 'wx', mode: 0o600 });
  for (const { path, content } of sourceEntries(decode(bytes, 'producer bundle'))) {
    const file = join(source, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, { flag: 'wx', mode: 0o600 });
  }
  const result = join(scratch, 'raw-secret.json');
  await scan('secret scan', ['fs', '--scanners', 'secret', '--format', 'json', '--output', result,
    '--timeout', '45s', source]);
  const report = decode(await readBounded(result), 'secret scan report');
  assert.ok(report.SchemaVersion === 2 && report.Trivy?.Version === scanner.version &&
    report.ArtifactType === 'filesystem' && resolve(report.ArtifactName) === resolve(source), 'Invalid secret scan report');
  const results = report.Results ?? [];
  assert.ok(Array.isArray(results) && results.every(target =>
    target.Class === 'secret' && Array.isArray(target.Secrets) && target.Secrets.length), 'Unexpected secret scan output');
  return { count: results.reduce((sum, target) => sum + target.Secrets.length, 0) };
}

export function scanSources({ bytes, auditBytes, executable }) {
  return scratchScan(executable, context => scanSecretInput(context, bytes, auditBytes));
}

async function scanBundle({ bundleBytes, lockBytes, image, output, executable }) {
  assert.match(image, imagePattern, 'Approved image digest required');
  return scratchScan(executable, async context => {
    const { scratch, cache, scan } = context;
    const secrets = await scanSecretInput(context, bundleBytes);
    assert.equal(secrets.count, 0, 'Secrets detected in the reviewed source bundle');

    await scan('database download', ['image', '--download-db-only', '--timeout', '2m']);
    const metadata = decode(await readBounded(join(cache, 'db', 'metadata.json')), 'database metadata');
    assert.equal(metadata.Version, 2, 'Unsupported vulnerability database schema');
    const database = { updatedAt: metadata.UpdatedAt,
      sha256: await digestDatabase(join(cache, 'db', 'trivy.db')) };
    assertFresh(database, new Date());

    const raw = join(scratch, 'raw-runtime.json');
    await scan('vulnerability scan', ['image', '--image-src', 'docker', '--platform', platform,
      '--scanners', 'vuln', '--list-all-pkgs', '--offline-scan', '--skip-db-update', '--skip-java-db-update',
      '--format', 'json', '--output', raw, '--timeout', '4m', image]);
    const report = decode(await readBounded(raw, 64 * 1024 * 1024), 'runtime scan');
    assert.equal(report.Trivy?.Version, scanner.version, 'Unexpected runtime scanner version');
    const runtime = summarizeRuntime(report, image);
    const reportBytes = Buffer.from(encode({
      schemaVersion: 1, scanner, bundleSha256: sha256(bundleBytes), image, platform, secrets, database, runtime,
    }));

    const cyclonedx = join(scratch, 'runtime.cdx.json');
    await scan('SBOM conversion', ['convert', '--format', 'cyclonedx', '--output', cyclonedx, raw]);
    const sbom = decode(await readBounded(cyclonedx, 64 * 1024 * 1024), 'runtime SBOM');
    for (const { path, content } of sourceEntries(decode(bundleBytes, 'verified bundle'))) {
      sbom.components.push({
        type: 'file', 'bom-ref': 'forge-source:' + path, name: path,
        hashes: [{ alg: 'SHA-256', content: sha256(content) }],
      });
    }
    const sbomBytes = Buffer.from(encode(sbom));
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'security.json'), reportBytes, { flag: 'wx' });
    await writeFile(join(output, 'sbom.cdx.json'), sbomBytes, { flag: 'wx' });
    const promotion = createPromotion({ bundleBytes, lockBytes, image, reportBytes, sbomBytes });
    await writeFile(join(output, 'promotion.json'), encode(promotion), { flag: 'wx' });
  });
}

async function main(args) {
  const [mode, input, lock, image, output, executable] = args;
  if (mode === 'source' && args.length === 4) {
    const bytes = await readBounded(input);
    const auditBytes = lock === '-' ? undefined : await readBounded(lock);
    assert.equal((await scanSources({ bytes, auditBytes, executable: image })).count, 0, 'Secrets detected before source handoff');
    return;
  }
  assert.ok((mode === 'scan' && args.length === 6) || (mode === 'verify' && args.length === 5),
    'Usage: supply-chain.mjs source BUNDLE AUDIT|- TRIVY or scan|verify VERIFIED LOCK IMAGE OUTPUT [TRIVY]');
  const bundleBytes = await readBounded(input);
  const lockBytes = await readBounded(lock);
  if (mode === 'scan') {
    await scanBundle({ bundleBytes, lockBytes, image, output, executable });
  } else {
    const promotion = decode(await readBounded(join(output, 'promotion.json')), 'signed promotion');
    const reportBytes = await readBounded(join(output, 'security.json'), 64 * 1024 * 1024);
    const sbomBytes = await readBounded(join(output, 'sbom.cdx.json'), 64 * 1024 * 1024);
    validatePromotion(promotion, { bundleBytes, lockBytes, image, reportBytes, sbomBytes });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    // Never print untrusted values, raw reports, or Error properties such as actual/expected.
    process.stderr.write('Supply-chain gate failed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
