import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runtimeLimits } from './qualification-runtime.mjs';
import { validatePromotion } from './supply-chain.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const releaseJob = 'Authenticate and rehearse release, fault and recovery';

export function jobTimeline(run, jobs, product, runtime, release = releaseJob) {
  const suffix = '(' + product + ', ' + runtime + ')';
  const stages = jobs.filter(job => job.name.endsWith(suffix) && ['success', 'failure', 'cancelled', 'timed_out'].includes(job.conclusion))
    .map(job => {
      const start = Date.parse(job.started_at);
      const end = Date.parse(job.completed_at);
      assert.ok(Number.isFinite(start) && end >= start, 'Invalid job duration');
      return { name: job.name.split(' / ').at(-1), conclusion: job.conclusion, end,
        seconds: (end - start) / 1000 };
    });
  const released = stages.filter(stage => stage.name === release + ' ' + suffix && stage.conclusion === 'success');
  assert.equal(released.length, 1, 'Exactly one successful release job required');
  const leadSeconds = (released[0].end - Date.parse(run.created_at)) / 1000;
  assert.ok(Number.isFinite(leadSeconds) && leadSeconds >= 0, 'Invalid lead time');
  return { leadSeconds, runnerSeconds: stages.reduce((total, stage) => total + stage.seconds, 0),
    failedJobs: stages.filter(stage => stage.conclusion !== 'success').length,
    stages: stages.map(({ end, ...stage }) => stage) };
}

export function gateRuntime(metrics) {
  return Object.entries(runtimeLimits).flatMap(([metric, limit]) => {
    assert.ok(Number.isSafeInteger(metrics[metric]) && metrics[metric] >= 0, 'Missing runtime measurement: ' + metric);
    return metrics[metric] > limit ? [{ metric, limit, observed: metrics[metric] }] : [];
  });
}

async function productReport(root, product, run, jobs, lockBytes) {
  const security = join(root, 'agent-security-' + product);
  const release = join(root, 'agent-release-' + product + '-attempt-' + run.run_attempt);
  const [bundleBytes, reportBytes, sbomBytes, promotion, drill, metrics, slsa, proof, audit, reproduced, tamper, missing] =
    await Promise.all([
      readFile(join(security, 'verified.json')), readFile(join(security, 'security.json')),
      readFile(join(security, 'sbom.cdx.json')), json(join(security, 'promotion.json')),
      json(join(release, 'recovery.json')), json(join(release, 'runtime-metrics.json')),
      json(join(release, 'slsa-verification.json')), json(join(release, 'signature-verification.json')),
      readFile(join(root, 'agent-producer-' + product, 'agent-audit.jsonl')),
      readFile(join(release, 'reproduced-sha256.txt'), 'utf8'),
      readFile(join(release, 'tamper-rejection.log')), readFile(join(release, 'missing-evidence-rejection.log')),
    ]);
  validatePromotion(promotion, { bundleBytes, lockBytes, image: promotion.image, reportBytes, sbomBytes });
  const bundle = JSON.parse(bundleBytes);
  const hash = digest(bundleBytes);
  const source = run.head_sha;
  assert.equal(bundle.run, String(run.id));
  assert.equal(bundle.product, product);
  assert.equal(bundle.source, source);
  assert.equal(bundle.authorship.sha256, digest(audit), 'Agent audit digest mismatch');
  for (const entry of [metrics, drill]) {
    assert.equal(entry.product, product);
    assert.equal(entry.source, source);
    assert.equal(entry.bundleSha256, hash, 'Runtime bundle digest mismatch');
  }
  assert.equal(metrics.run, String(run.id));
  assert.equal(metrics.schemaVersion, 1);
  const proves = (results, sha) => results.some(item => item.verificationResult.statement.subject.some(subject => subject.digest.sha256 === sha));
  assert.ok(proves(slsa, hash) && proves(proof, digest(await readFile(join(security, 'promotion.json')))), 'Missing verified subjects');
  assert.ok(tamper.length > 0 && missing.length > 0 && reproduced.split(/\s/)[0] === hash, 'Missing rejection or reproduction evidence');
  const events = drill.recovery.events;
  assert.ok(drill.recovery.passed && events.length === 6 && events[4].phase === 'observe-injected' &&
    events[4].passed === false && events[5].phase === 'observe-restored' && events[5].passed === true &&
    events[5].release === events[3].release, 'Fault/recovery evidence mismatch');
  assert.deepEqual(metrics.observations.map(({ phase, count }) => [phase, count]),
    events.map(({ phase, checks }) => [phase, checks.length]), 'Runtime probe evidence mismatch');
  const checks = Object.values(bundle.evidence).flatMap(revision => revision.acceptance.checks);
  assert.ok(checks.length && checks.every(check => check.passed), 'Missing acceptance pass');
  const records = audit.toString().trim().split(/\r?\n/).map(line => JSON.parse(line));
  const preflights = records.filter(event => event.decision === 'preflight');
  const repairs = records.filter(event => event.role === 'repair').length;
  const runtime = promotion.image.match(/library\/(node|python)@/)?.[1];
  assert.ok(runtime, 'Unknown runtime');
  return { product, runtime, sourceOrigin: bundle.origin ?? null, acceptanceChecks: checks.length,
    agentSessions: records.filter(event => event.role).length, repairAttempts: repairs,
    successfulRepairs: preflights.filter(event => event.attempt === 1 && event.accepted).length,
    repairSuccessRate: repairs === 0 ? null : preflights.filter(event => event.attempt === 1 && event.accepted).length / repairs,
    ...jobTimeline(run, jobs, product, runtime),
    sbomComponents: JSON.parse(sbomBytes).components.length, bundleSha256: hash,
    injectedFailures: 1, verifiedRestorations: 1, runtimeMeasurements: metrics,
    alerts: gateRuntime(metrics) };
}

async function main([runPath, jobsPath, root, output]) {
  const [run, { jobs }, lock] = await Promise.all([json(runPath), json(jobsPath), readFile('apm.lock.yaml')]);
  assert.match(run.head_sha, /^[0-9a-f]{40}$/);
  assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt >= 1);
  assert.ok(Array.isArray(jobs));
  const { include } = JSON.parse(process.env.QUALIFICATION_MATRIX);
  const expected = include.map(entry => entry.product);
  assert.ok(expected.length && new Set(expected).size === expected.length && expected.every(id => /^[a-z][a-z0-9-]*$/.test(id)),
    'Invalid qualification product set');
  const products = await Promise.all(expected.map(product => productReport(root, product, run, jobs, lock)));
  const passed = products.every(product => product.alerts.length === 0);
  const report = { schemaVersion: 1, scope: 'isolated-rehearsal', run: run.id, source: run.head_sha,
    attempt: run.run_attempt, rerunActions: run.run_attempt - 1, passed, limits: runtimeLimits,
    providerCost: null, billedRunnerCost: null, distinctOperators: null, productionChangeFailureRate: null,
    productionRecoveryTime: null, products };
  const markdown = [
    '# ForgeKit qualification', '',
    'Isolated rehearsal for run ' + report.run + ', attempt ' + report.attempt + '.', '',
    '| Product | Acceptance checks | Lead time (s) | Runner time (s) | Probe p95 (ms) | Recovery (ms) |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...products.map(p => '| ' + [p.product, p.acceptanceChecks, p.leadSeconds, p.runnerSeconds,
      p.runtimeMeasurements.healthyProbeP95Ms, p.runtimeMeasurements.recoveryMs].join(' | ') + ' |'),
    '', 'Thresholds are 2,500 ms probe p95 and 30,000 ms recovery.', '',
    ...(passed ? ['All rehearsal thresholds passed.'] :
      products.flatMap(p => p.alerts.map(a => '- Alert for ' + p.product + ' ' + a.metric + ' at ' + a.observed + ' ms.'))),
    '', 'Runner time sums product jobs across attempts and is not a billing measure.',
    'Probe timing includes container startup and cleanup. Recovery runs from the final failed probe to the final healthy probe.',
    'Rerun actions observed: ' + report.rerunActions + '. Distinct operators, billed costs and production metrics are unavailable.',
    'Agent sessions and repair results from archived source belong to the origin run.', '',
  ].join('\n');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'qualification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(output, 'qualification.md'), markdown, { flag: 'wx' });
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main(process.argv.slice(2));
}
