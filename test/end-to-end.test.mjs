import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { gradeReview } from '../evals/review.mjs';

const exec = promisify(execFile);
const cli = new URL('../factory/cli.mjs', import.meta.url);
const paths = {
  requirements: 'test/fixtures/delegated/requirements.json',
  direct: ['architecture/slice.json', 'architecture/slice.c4'],
  delegated: ['test/fixtures/delegated/architecture.json', 'test/fixtures/delegated/architecture.c4'],
};

async function scenario(t, mode, source = paths.requirements) {
  const directory = await mkdtemp(join(tmpdir(), 'forge-e2e-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const inputs = join(directory, 'inputs');
  await mkdir(inputs);
  await Promise.all([
    copyFile(source, join(inputs, 'requirements.json')),
    copyFile(paths[mode][0], join(inputs, 'architecture.json')),
    copyFile(paths[mode][1], join(inputs, 'architecture.c4')),
  ]);
  const output = join(directory, 'output');
  const command = (...args) => exec(process.execPath, [
    fileURLToPath(cli),
    ...args, output, '--inputs', inputs,
  ], { env: { FORGE_DECISION_PACKAGE: process.env.FORGE_DECISION_PACKAGE }, timeout: 10000 });
  const artifact = name => readFile(join(output, name), 'utf8');
  const receipt = async () => JSON.parse(await artifact('receipt.json'));
  return { inputs, output, command, artifact, receipt };
}

test('the same product requirement runs through two different deployed architectures', async t => {
  const direct = await scenario(t, 'direct');
  const delegated = await scenario(t, 'delegated');
  for (const run of [direct, delegated]) {
    await run.command('run');
    await run.command('verify');
  }
  const one = await direct.receipt();
  const two = await delegated.receipt();
  assert.deepEqual(one.predicate.materials[0], two.predicate.materials[0]);
  assert.notDeepEqual(one.subject, two.subject);
  assert.deepEqual(one.predicate.observation, { stdout: 'ready\n', stderr: '' });
  assert.deepEqual(two.predicate.observation, { stdout: 'ready\n', stderr: 'worker:readiness_worker\n' });
  assert.equal(JSON.parse(await direct.artifact('plan.json')).implementation.mode, 'direct');
  assert.deepEqual(JSON.parse(await delegated.artifact('plan.json')).implementation,
    { mode: 'delegated', worker: 'readiness_worker' });
  assert.doesNotMatch(await direct.artifact('deployed.mjs'), /spawnSync/);
  assert.match(await delegated.artifact('deployed.mjs'), /spawnSync/);
  const wrongTopology = await direct.artifact('deployed.mjs');
  await writeFile(join(delegated.output, 'deployed.mjs'), wrongTopology);
  two.subject[0].digest.sha256 = createHash('sha256').update(wrongTopology).digest('hex');
  await writeFile(join(delegated.output, 'receipt.json'), JSON.stringify(two));
  await assert.rejects(delegated.command('verify'), /acceptance/);
});

test('a stale LikeC4 view and missing CALM owner stop the run before build', async t => {
  const stale = await scenario(t, 'delegated');
  await copyFile(paths.direct[1], join(stale.inputs, 'architecture.c4'));
  await assert.rejects(stale.command('run'), /LikeC4/);
  await assert.rejects(stale.artifact('candidate.mjs'), { code: 'ENOENT' });
  const missing = await scenario(t, 'direct');
  const reqPath = join(missing.inputs, 'requirements.json');
  const req = JSON.parse(await readFile(reqPath));
  await writeFile(reqPath, JSON.stringify({ ...req, node: 'missing' }));
  await assert.rejects(missing.command('run'), /target/);
  await assert.rejects(missing.artifact('candidate.mjs'), { code: 'ENOENT' });
  const wrongEdge = await scenario(t, 'delegated');
  const modelPath = join(wrongEdge.inputs, 'architecture.json');
  const model = JSON.parse(await readFile(modelPath));
  const edge = model.relationships[0]['relationship-type'].connects;
  [edge.source, edge.destination] = [edge.destination, edge.source];
  await writeFile(modelPath, JSON.stringify(model));
  await assert.rejects(wrongEdge.command('run'), /CALM delegation/);
  await assert.rejects(wrongEdge.artifact('candidate.mjs'), { code: 'ENOENT' });
});

test('changing the product requirement changes behavior without changing topology', async t => {
  const baseline = await scenario(t, 'delegated');
  const updated = await scenario(t, 'delegated');
  await baseline.command('run');
  const reqPath = join(updated.inputs, 'requirements.json');
  const requirement = JSON.parse(await readFile(reqPath));
  await writeFile(reqPath, JSON.stringify({ ...requirement, expectedOutput: 'healthy' }));
  await updated.command('run');
  await updated.command('verify');
  const first = await baseline.receipt();
  const second = await updated.receipt();
  assert.deepEqual(first.predicate.materials.slice(1), second.predicate.materials.slice(1));
  assert.deepEqual(first.predicate.implementation, second.predicate.implementation);
  assert.equal(second.predicate.observation.stdout, 'healthy\n');
  await copyFile(paths.requirements, reqPath);
  await assert.rejects(updated.command('verify'), /acceptance/);
});

test('an injected code mutation is rejected before deployment, then repaired and verified', async t => {
  const broken = await scenario(t, 'delegated');
  await broken.command('run', '--fault=wrong-output-once');
  const evidence = await broken.receipt();
  assert.equal(evidence.predicate.repairs, 1);
  assert.match(await broken.artifact('rejected.mjs'), /broken/);
  assert.doesNotMatch(await broken.artifact('deployed.mjs'), /broken/);
  await broken.command('verify');
  await writeFile(join(broken.output, 'rejected.mjs'), 'tampered');
  await assert.rejects(broken.command('verify'), /Rejected candidate digest/);
});

test('a persistent code mutation exhausts the budget without deploying', async t => {
  const broken = await scenario(t, 'delegated');
  await assert.rejects(broken.command('run', '--fault=wrong-output-always'), /repair denied/);
  assert.deepEqual(JSON.parse(await broken.artifact('state.json')).slice(-6),
    ['build', 'test', 'repair', 'build', 'test', 'escalated']);
  for (const name of ['deployed.mjs', 'receipt.json']) {
    await assert.rejects(broken.artifact(name), { code: 'ENOENT' });
  }
});

test('the review eval rejects unsupported proof and stops a false promotion claim', async t => {
  const run = await scenario(t, 'delegated');
  await run.command('run');
  await run.command('verify');
  const receipt = await run.receipt();
  const good = {
    verdict: 'review-ready',
    subject: receipt.subject[0].digest.sha256,
    requirement: receipt.predicate.requirement,
    repairs: 0,
    signed: false,
    environment: 'local',
  };
  assert.equal(gradeReview(receipt, good).passed, true);
  assert.deepEqual(gradeReview(receipt, { ...good, approvedForProduction: true }).failed, ['unexpected-claims']);
  const invalidReport = { ...good, subject: 'wrong', signed: true, environment: 'production' };
  const bad = gradeReview(receipt, invalidReport);
  assert.equal(bad.passed, false);
  assert.deepEqual(bad.failed, ['subject', 'signed', 'environment']);
  const reportPath = join(run.output, 'review.json');
  await writeFile(reportPath, JSON.stringify(good));
  assert.deepEqual(JSON.parse((await run.command('grade', '--review', reportPath)).stdout), { passed: true, failed: [] });
  await writeFile(reportPath, JSON.stringify(invalidReport));
  await assert.rejects(run.command('grade', '--review', reportPath), error => {
    assert.deepEqual(JSON.parse(error.stdout), bad);
    return true;
  });
});
