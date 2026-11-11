import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run, validateArchitecture, verifyRun } from '../factory/slice.mjs';
import { apmManifest, assemble, routeRepair } from '../factory/integrations.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));

async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'forge-kit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'run');
}

test('runs all stages and binds the deployed bytes to independent evidence', async t => {
  const output = await workspace(t);
  const receipt = await run(output);
  assert.deepEqual(receipt.predicate.stages, [
    'requirements', 'architecture', 'plan', 'build', 'test',
    'deploy', 'observe', 'evidence', 'review-ready'
  ]);
  assert.equal(receipt._type, 'https://in-toto.io/Statement/v1');
  assert.equal(await verifyRun(output), true);
  await writeFile(join(output, 'deployed.mjs'), 'changed after acceptance');
  await assert.rejects(verifyRun(output), /digest/);
});

test('repairs a rejected build once and escalates when policy gives it no budget', async t => {
  const output = await workspace(t);
  const receipt = await run(output, { faultyFirstBuild: true });
  assert.equal(receipt.predicate.repairs, 1);
  assert.deepEqual(receipt.predicate.stages.slice(3, 8), ['build', 'test', 'repair', 'build', 'test']);
  assert.equal(await verifyRun(output), true);
  await assert.rejects(
    run(output + '-blocked', { faultyFirstBuild: true, maxRepairs: 0 }),
    /repair denied/
  );
  await assert.rejects(readFile(join(output + '-blocked', 'receipt.json')), { code: 'ENOENT' });
});

test('rejects a CALM requirement target absent from the model and a drifting view', async () => {
  const calm = await json('architecture/slice.json');
  const requirements = await json('test/fixtures/delegated/requirements.json');
  const view = await readFile('architecture/slice.c4', 'utf8');
  assert.doesNotThrow(() => validateArchitecture(calm, requirements, view));
  assert.throws(() => validateArchitecture(calm, { ...requirements, node: 'missing' }, view), /target/);
  assert.throws(() => validateArchitecture(calm, requirements, view + 'model {}'), /view/);
});

test('a typed repair signal cannot exceed policy or authorize an unknown route', () => {
  const recommendation = { choice: 'retry-build', probability: 0.95 };
  assert.equal(routeRepair(recommendation, { used: 0, limit: 1 }), 'retry-build');
  assert.equal(routeRepair(recommendation, { used: 1, limit: 1 }), 'escalate');
  assert.equal(routeRepair({ ...recommendation, choice: 'deploy' }, { used: 0, limit: 1 }), 'escalate');
  assert.equal(routeRepair({ ...recommendation, probability: 1.2 }, { used: 0, limit: 1 }), 'escalate');
  assert.equal(routeRepair(null, { used: 0, limit: 1 }), 'escalate');
});

test('assembly reports unresolved capabilities and refuses mutable package references', async () => {
  const manifest = await json('factory/packages.json');
  assert.deepEqual(assemble(manifest).pending, []);
  manifest.capabilities.orchestration = null;
  assert.deepEqual(assemble(manifest).pending, ['orchestration']);
  assert.match(assemble(manifest).rehearsal, /^danielmeppiel\/apmx\/.+#[a-f0-9]{40}$/);
  manifest.rehearsal.ref += '\n';
  assert.throws(() => assemble(manifest), /commit SHA/);
  manifest.rehearsal.ref = 'main';
  assert.throws(() => assemble(manifest), /commit SHA/);
});

test('the APM installer and GitHub workflow use the reviewed catalog pins', async () => {
  const manifest = await json('factory/packages.json');
  const assembly = assemble(manifest);
  assert.match(assembly.orchestrator, /^richgo\/forge-kit-skills\/\.github\/workflows\/forge-factory\.lock\.yml@[a-f0-9]{40}$/);
  assert.equal(await readFile('apm.yml', 'utf8'), apmManifest(assembly.packages));
  const release = await readFile('.github/workflows/factory-e2e.yml', 'utf8');
  assert.deepEqual([...release.matchAll(/^\s+uses: (richgo\/forge-kit-skills\/[^\s]+)$/gm)].map(match => match[1]), [
    assembly.orchestrator,
    assembly.orchestrator.replace('forge-factory.lock.yml', 'forge-factory-worker.yml'),
  ]);
  assert.match(release, /options: \[current\]/);
  assert.doesNotMatch(release, /catalog_fixture|forge-reference|FORGE_REHEARSAL_REF|inject_fault|use_jev|baseline|step-free/);
  const workflow = await readFile('.github/workflows/catalog-rehearsal.yml', 'utf8');
  const callers = [...workflow.matchAll(/^\s+uses: (richgo\/forge-kit-skills\/[^\s]+)$/gm)];
  assert.deepEqual(callers.map(match => match[1]), [
    assembly.orchestrator,
    assembly.orchestrator.replace("forge-factory.lock.yml", "forge-reference.lock.yml"),
  ]);
});

test('an exhausted repair spend budget prevents contacting Jev and promotion', async t => {
  const output = await workspace(t);
  let consulted = false;
  await assert.rejects(run(output, {
    fault: 'wrong-output-once',
    repairBudget: { timeLimitMs: 2000, spendLimitUnits: 0, retryCostUnits: 1 },
    recommendRepair: () => { consulted = true; return { choice: 'retry-build', probability: 1 }; },
  }), /repair denied/);
  assert.equal(consulted, false);
  await assert.rejects(readFile(join(output, 'deployed.mjs')), { code: 'ENOENT' });
  const [decision] = await json(join(output, 'repair-decisions.json'));
  assert.equal(decision.route, 'escalate');
  assert.equal(decision.advisor, 'budget-exhausted');
  assert.equal(decision.budget.spentUnits, 0);
  assert.match(decision.rejected.digest.sha256, /^[a-f0-9]{64}$/);
});

test('a stalled repair advisor times out without authorizing a retry', async t => {
  const output = await workspace(t);
  await assert.rejects(run(output, {
    fault: 'wrong-output-once',
    repairBudget: { timeLimitMs: 40, spendLimitUnits: 1, retryCostUnits: 1 },
    recommendRepair: state => {
      assert.deepEqual(state, { failure: 'readiness-mismatch', used: 0, limit: 1 });
      return new Promise(() => {});
    },
  }), /repair denied/);
  const [decision] = await json(join(output, 'repair-decisions.json'));
  assert.equal(decision.route, 'escalate');
  assert.equal(decision.recommendation, null);
  await assert.rejects(readFile(join(output, 'deployed.mjs')), { code: 'ENOENT' });
});

test('independent verification rejects altered repair evidence', async t => {
  const output = await workspace(t);
  await run(output, { faultyFirstBuild: true });
  const path = join(output, 'repair-decisions.json');
  const decisions = await json(path);
  decisions[0].budget.spendLimitUnits = 0;
  await writeFile(path, JSON.stringify(decisions));
  await assert.rejects(verifyRun(output), /Repair decision violates the retry budget/);
});

test('the hosted verifier requires its configured advisor and budget, regardless of the producer report', async t => {
  const output = await workspace(t);
  await run(output, { faultyFirstBuild: true });
  await assert.rejects(verifyRun(output, { expectedRepairAdvisor: 'typed-advisor' }), /Unexpected repair advisor/);
  const path = join(output, 'repair-decisions.json');
  const decisions = await json(path);
  decisions[0].budget.spendLimitUnits = 9;
  await writeFile(path, JSON.stringify(decisions));
  await assert.rejects(verifyRun(output, { expectedRepairAdvisor: 'fixture-policy' }), /Unexpected repair budget/);
});
