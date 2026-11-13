import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { bindApmxEvidence } from '../../factory/apmx-evidence.mjs';

const exec = promisify(execFile);
const factoryCommit = '89eed7bdb145e8ec64ba08091968558cfee97daa';
const factoryPath = 'packages/software-factory';
const factory = 'richgo/forge-kit-skills/' + factoryPath + '#' + factoryCommit;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(path);
const preflight = fileURLToPath(new URL('../../factory/check-product-unit.mjs', import.meta.url));

function runGit(root, ...args) {
  return execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

export function stageNativeUnit(workspace, unit, file, readFixture, sharedChange, specification) {
  assert.ok(['contract', 'api', 'web'].includes(unit), 'Unknown fixture unit');
  const child = 'checkout-' + unit;
  const childPath = relative => relative.replace('openspec/changes/' + sharedChange.change + '/',
    'openspec/changes/' + child + '/');
  for (const relative of [
    ...Object.keys(sharedChange.sha256).filter(path => path !== '.forge/openspec.json'), 'specs/product-requirements.md',
  ]) {
    const path = join(workspace, childPath(relative));
    const bytes = readFixture(relative);
    if (sharedChange.sha256[relative]) assert.equal(sha256(bytes), sharedChange.sha256[relative]);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
  const forge = join(workspace, '.forge');
  const binding = JSON.parse(readFixture('.forge/openspec.json'));
  binding.change = child;
  for (const link of Object.values(binding.acceptance)) link.spec = childPath(link.spec);
  mkdirSync(forge);
  writeFileSync(join(forge, 'openspec.json'), JSON.stringify(binding));
  writeFileSync(join(forge, 'shared-change.json'), JSON.stringify(specification));
  writeFileSync(join(forge, 'shared-specification.json'), JSON.stringify(sharedChange.sha256));
  writeFileSync(join(forge, 'verify-unit.mjs'), readFixture('verify-unit.mjs'));
  writeFileSync(join(forge, 'expected-contract.json'), readFixture('services/contract/schema.json'));
  writeFileSync(join(forge, 'verify-baseline'), 'node .forge/verify-unit.mjs baseline ' + unit + ' "$@"\n');
  writeFileSync(join(forge, 'verify-change'), [
    'patch="$1"',
    'shift',
    'git apply -- "$patch"',
    'node .forge/verify-unit.mjs candidate ' + unit + ' "$@"',
    '',
  ].join('\n'));
  writeFileSync(join(workspace, 'request.md'), [
    '# Approved change request', '## Stories', '- `STORY-001`', '## Allowed source paths',
    '- `' + file + '`', '',
  ].join('\n'));
}

function receipt(workspace) {
  const chains = join(workspace, '.apm', 'chains');
  const entries = readdirSync(chains, { withFileTypes: true }).filter(entry => entry.isDirectory());
  assert.equal(entries.length, 1, 'Expected one native APMX chain');
  return join(chains, entries[0].name, 'receipt.intoto.jsonl');
}

export function nativeReplay({ apmx, root, source, readFixture, files, artifacts, plan, evidenceDirectory }) {
  const catalog = join(root, 'pinned-skills');
  mkdirSync(catalog);
  runGit(catalog, 'init', '-q');
  runGit(catalog, 'fetch', '--quiet', '--depth=1', 'https://github.com/richgo/forge-kit-skills.git', factoryCommit);
  assert.equal(runGit(catalog, 'rev-parse', 'FETCH_HEAD').toString().trim(), factoryCommit);
  const contracts = Object.fromEntries(['plan', 'specification', 'build', 'review'].map(stage =>
    [stage, sha256(runGit(catalog, 'show', 'FETCH_HEAD:' + factoryPath + '/contracts/' + stage + '.contract.md'))]));

  const workspaces = new Map();
  const planPath = join(root, 'approved-plan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  async function run(workspace, args, extra = {}) {
    try {
      await exec(apmx, args, {
        cwd: workspace, timeout: 240_000, maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, ...extra },
      });
    } catch (error) {
      throw new Error('Native APMX failed in ' + workspace + '\n' + (error.stdout ?? '') + (error.stderr ?? ''),
        { cause: error });
    }
  }

  return {
    async build(unit) {
      const original = source[unit.source.repository.split('/')[1]];
      const staging = join(root, 'producer-' + unit.id);
      const independent = join(root, 'verifier-' + unit.id);
      const producer = join(staging, 'target');
      const verifier = join(independent, 'target');
      const bundle = join(root, 'recorded-outputs-' + unit.id);
      const path = files[unit.id];
      mkdirSync(staging);
      mkdirSync(independent);
      for (const checkout of [producer, verifier]) {
        runGit(root, 'clone', '--quiet', '--local', original, checkout);
        assert.equal(runGit(checkout, 'rev-parse', 'HEAD').toString().trim(), unit.source.revision);
        runGit(checkout, 'remote', 'remove', 'origin');
      }
      execFileSync(process.execPath, [preflight], {
        cwd: staging,
        stdio: 'pipe',
        env: { ...process.env, PRODUCT_PLAN: planPath, PRODUCT_UNIT: unit.id, TARGET_WORKSPACE: unit.source.path },
      });
      const producing = join(producer, unit.source.path);
      const checking = join(verifier, unit.source.path);
      const old = read(join(producing, path));
      const updated = readFixture('services/' + unit.id + '/' + path);
      writeFileSync(join(producing, path), updated);
      const patch = runGit(producing, 'diff', '--relative', '--full-index', '--no-renames');
      assert.ok(patch.length, 'Expected a real source patch for ' + unit.id);
      writeFileSync(join(producing, path), old);
      for (const [stage, outputs] of Object.entries({
        plan: { 'plan.md': 'Verify the reviewed checkout currency scenario for ' + unit.id + '.\n' },
        specification: { 'specification.md': 'Apply AC-001 in ' + path + '.\n' },
        build: { 'changes.diff': patch, 'implementation.md': 'Support checkout currency in ' + path + '.\n' },
        review: { 'review.md': 'Review the independently checked checkout currency patch.\n' },
      })) {
        const destination = join(bundle, contracts[stage]);
        mkdirSync(destination, { recursive: true });
        for (const [name, content] of Object.entries(outputs)) writeFileSync(join(destination, name), content);
      }
      const origin = { APMX_BASE_REPOSITORY: unit.source.repository, APMX_BASE_COMMIT: unit.source.revision };
      await run(producing, ['--from', factory, '--on', 'replay', '--allow-host-access', '--allow-unproven-inputs'],
        { ...origin, APMX_REPLAY_BUNDLE: bundle });
      workspaces.set(unit.id, { checking, origin, receipt: receipt(producing) });
      return { sha256: sha256(JSON.stringify([[path, sha256(updated)]])) };
    },

    async verifyUnit(unit, artifact, context) {
      const producer = workspaces.get(unit.id);
      await run(producer.checking, ['check', producer.receipt, '--from', factory], producer.origin);
      const checked = receipt(producer.checking);
      const output = join(dirname(checked), 'outputs', files[unit.id]);
      const raw = read(checked);
      const statements = raw.toString('utf8').trim().split(/\r?\n/).map(line =>
        JSON.parse(Buffer.from(JSON.parse(line).payload, 'base64').toString('utf8')));
      const statement = statements.find(value => value.predicateType === 'https://slsa.dev/provenance/v1');
      assert.equal(context.planSha256, plan.sha256);
      const { buildDefinition } = statement.predicate;
      assert.equal(buildDefinition.externalParameters.factory.commit, factoryCommit);
      assert.ok(buildDefinition.resolvedDependencies.some(entry =>
        entry.annotations?.['apmx.role'] === 'producer-receipt' &&
        entry.digest.sha256 === sha256(read(producer.receipt))), 'Receipt must bind the replayed producer');
      assert.ok(statements.some(({ predicate }) => predicate.result === 'PASSED' &&
        predicate.configuration?.some(item => item.annotations?.stage === 'plan' &&
          item.annotations?.check === 'baseline-acceptance')), 'Expected independent baseline proof');
      const contentSha256 = sha256(read(output));
      const deliveryPath = unit.source.path === '.' ? files[unit.id] : unit.source.path + '/' + files[unit.id];
      const delivered = { [deliveryPath]: contentSha256 };
      // This local verifier owns the receipt bytes it just generated. The hosted
      // entry point supplies the equivalent statements only after signature verification.
      const verified = bindApmxEvidence(plan, unit.id, raw, { lines: statements }, delivered, factory);
      assert.equal(verified.artifactSha256, artifact.sha256);
      if (evidenceDirectory) {
        mkdirSync(evidenceDirectory, { recursive: true });
        cpSync(dirname(checked), join(evidenceDirectory, unit.id), {
          recursive: true, force: false, errorOnExist: true,
        });
      }
      artifacts[unit.id] = { path: output };
      return verified;
    },
  };
}
