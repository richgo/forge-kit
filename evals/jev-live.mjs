import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requestJevRepair, routeRepair } from '../factory/integrations.mjs';
import { run, verifyRun } from '../factory/slice.mjs';

const token = process.env.FORGE_JEV_TOKEN;
assert.ok(token, 'Configure the FORGE_JEV_TOKEN repository secret');

const budget = { used: 0, limit: 1, elapsedMs: 0, timeLimitMs: 15_000,
  spentUnits: 0, spendLimitUnits: 1, retryCostUnits: 1 };

async function consult(state, { timeoutMs } = {}) {
  let httpStatus;
  const recommendation = await requestJevRepair(token, async (...args) => {
    const response = await fetch(...args);
    httpStatus = response.status;
    return response;
  }, { state, timeoutMs });
  return { state, httpStatus: httpStatus ?? null, recommendation, route: routeRepair(recommendation, budget) };
}

async function assertUnpromoted(output) {
  await assert.rejects(readFile(join(output, 'deployed.mjs')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(output, 'receipt.json')), { code: 'ENOENT' });
}

const root = await mkdtemp(join(tmpdir(), 'forge-jev-'));
try {
  const report = { provider: 'TypeSafe Jev', cases: [], policy: [] };
  const output = join(root, 'run');
  let confirmed;
  const attempt = run(output, {
    fault: 'wrong-output-once',
    recommendRepair: async (state, options) => {
      confirmed = await consult(state, options);
      return confirmed.recommendation;
    },
  });
  let observed;
  try {
    assert.equal((await attempt).predicate.repairs, 1);
    await verifyRun(output);
    observed = 'verified-retry';
  } catch (error) {
    if (!/repair denied/.test(error.message)) throw error;
    await assertUnpromoted(output);
    observed = 'escalated-without-promotion';
  }
  assert.ok(confirmed, 'The eligible runtime rejection must consult Jev');
  report.cases.push({ ...confirmed, expected: 'retry-build', observed,
    passed: confirmed.route === 'retry-build' && observed === 'verified-retry' });

  for (const failure of ['unclassified-failure', 'ambiguous-failure']) {
    const result = await consult({ failure, used: 0, limit: 1 });
    report.cases.push({ ...result, expected: 'escalate', passed: result.recommendation !== null &&
      result.route === 'escalate' && (failure === 'ambiguous-failure' || result.recommendation.choice === 'escalate') });
  }

  for (const [limit, options] of [
    ['attempt', { maxRepairs: 0 }],
    ['spend', { repairBudget: { timeLimitMs: 15_000, spendLimitUnits: 0, retryCostUnits: 1 } }],
  ]) {
    const blockedOutput = join(root, limit);
    let consultations = 0;
    await assert.rejects(run(blockedOutput, {
      ...options,
      fault: 'wrong-output-once',
      recommendRepair: () => { consultations++; return confirmed.recommendation; },
    }), /repair denied/);
    await assertUnpromoted(blockedOutput);
    assert.equal(consultations, 0);
    report.policy.push({ limit, observed: 'escalated-without-consultation-or-promotion' });
  }

  const timedOutput = join(root, 'time');
  let timedConsultations = 0;
  await assert.rejects(run(timedOutput, {
    fault: 'wrong-output-once',
    repairBudget: { timeLimitMs: 100, spendLimitUnits: 1, retryCostUnits: 1 },
    recommendRepair: () => { timedConsultations++; return new Promise(() => {}); },
  }), /repair denied/);
  await assertUnpromoted(timedOutput);
  assert.equal(timedConsultations, 1);
  report.policy.push({ limit: 'time', observed: 'escalated-after-stalled-advisor-without-promotion' });

  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.cases.every(result => result.passed), 'A live Jev case missed its expected outcome');
} finally {
  await rm(root, { recursive: true, force: true });
}
