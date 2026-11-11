import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

const exec = promisify(execFile);
assert.ok(process.env.FORGE_REQUIREMENTS_PACKAGE, 'Set FORGE_REQUIREMENTS_PACKAGE to the pinned package directory');
const requirementsPackage = resolve(process.env.FORGE_REQUIREMENTS_PACKAGE);
const checker = join(requirementsPackage, 'checks', 'apmx-requirements-check.mjs');

test('a product story travels through architecture, build, repair, deployment and APMX verification', async t => {
  const root = await mkdtemp(join(tmpdir(), 'forge-story-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const inputs = join(root, 'inputs');
  const output = join(root, 'run');
  await mkdir(inputs);
  await Promise.all([
    copyFile('examples/product-requirements.md', join(inputs, 'product-requirements.md')),
    copyFile('examples/acceptance.json', join(inputs, 'acceptance.json')),
    copyFile('test/fixtures/delegated/architecture.json', join(inputs, 'architecture.json')),
    copyFile('test/fixtures/delegated/architecture.c4', join(inputs, 'architecture.c4')),
  ]);
  const cli = (command, ...args) => exec(process.execPath,
    ['factory/cli.mjs', command, output, '--inputs', inputs, '--story', 'STORY-001', ...args], {
      env: {
        FORGE_REQUIREMENTS_PACKAGE: requirementsPackage,
        FORGE_DECISION_PACKAGE: process.env.FORGE_DECISION_PACKAGE,
      },
      timeout: 15000,
    }
  );
  await cli('run', '--fault', 'wrong-output-once');
  await cli('verify');
  const receipt = JSON.parse(await readFile(join(output, 'receipt.json')));
  const plan = JSON.parse(await readFile(join(output, 'plan.json')));
  assert.deepEqual(plan.trace, receipt.predicate.trace);
  const { epic, feature, story, node, criteria } = plan.trace;
  assert.deepEqual([epic, feature, story, node], ['EPIC-001', 'FEAT-001', 'STORY-001', 'health_probe']);
  assert.deepEqual(criteria.map(item => item.id), ['AC-001', 'AC-002']);
  assert.equal(receipt.predicate.repairs, 1);
  assert.equal(receipt.predicate.implementation.mode, 'delegated');
  assert.equal(receipt.predicate.observation.exitCode, 0);

  const { stdout } = await cli('requirements-evidence');
  const report = JSON.parse(stdout);
  for (const name of ['product-requirements.md', 'acceptance.json']) {
    await copyFile(join(inputs, name), join(output, name));
  }
  const reportPath = join(output, 'requirements-verification.json');
  await writeFile(reportPath, stdout);
  const apmxCheck = () => exec(process.execPath, [checker], { cwd: output, env: {}, timeout: 10000 });
  await apmxCheck();
  const planPath = join(output, 'plan.json');
  await writeFile(planPath, JSON.stringify({ ...plan, target: 'wrong' }));
  await assert.rejects(cli('verify'), /Plan targets a different CALM node/);
  await writeFile(planPath, JSON.stringify(plan));
  report.trace.story = 'STORY-999';
  await writeFile(reportPath, JSON.stringify(report));
  await assert.rejects(apmxCheck(), /verification report/);

  const productPath = join(inputs, 'product-requirements.md');
  const product = await readFile(productPath, 'utf8');
  await writeFile(productPath, product.replace('Print the readiness result', 'Display the readiness result'));
  await assert.rejects(cli('verify'), /Expected values to be strictly deep-equal/);
  await writeFile(productPath, product.replace('ac-001', 'unknown'));
  await assert.rejects(cli('verify'), /Unknown or mismatched independent check/);
});
