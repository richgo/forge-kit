import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { planArchitecture } from './architecture-plan.mjs';
import { acceptSource, approveArchitectureChanges, callCopilot, produceRevision, verifyAgentAudit } from './agent-production.mjs';
import { exerciseRecovery, verifyCandidate } from './agent-verifier.mjs';
import { createCheckpoint, readCheckpoint } from './delivery-checkpoint.mjs';
import { requestJevRepair } from './decisions.mjs';

const [mode, directory, input, output] = process.argv.slice(2);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const write = (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function readRevision(name, previous = null) {
  const root = join(directory, name);
  const [product, calm, likec4, cases] = await Promise.all([
    json(join(root, 'product.json')), json(join(root, 'architecture.json')),
    readFile(join(root, 'architecture.c4'), 'utf8'), json(join(root, 'acceptance.json')),
  ]);
  assert.match(product.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(['node', 'python'].includes(product.runtime), 'Unsupported product runtime');
  assert.ok(Array.isArray(product.files) && product.files.length > 0 && product.files.length <= 12);
  assert.equal(new Set(product.files).size, product.files.length, 'Duplicate source paths');
  assert.ok(product.files.includes(product.entry), 'Entry must be an approved source path');
  const extension = product.runtime === 'node' ? '.mjs' : '.py';
  for (const path of product.files) {
    assert.match(path, /^src\/[a-z][a-z0-9_-]*\.(?:mjs|py)$/);
    assert.ok(path.endsWith(extension), 'Source must use the approved runtime');
  }
  const nodes = new Set(calm.nodes.map(node => node['unique-id']));
  const storyIds = new Set();
  assert.ok(Array.isArray(product.stories) && product.stories.length > 0 && product.stories.length <= 12);
  for (const story of product.stories) {
    assert.match(story.id, /^STORY-[0-9]+$/);
    assert.ok(!storyIds.has(story.id), 'Duplicate story ID');
    storyIds.add(story.id);
    assert.ok(typeof story.description === 'string' && story.description.trim() && story.description.length <= 2000);
    assert.ok(Array.isArray(story.nodes) && story.nodes.length && story.nodes.every(node => nodes.has(node)),
      'Story must trace to CALM nodes');
  }
  assert.ok(Array.isArray(cases) && cases.length > 0 && cases.length <= 24);
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length, 'Duplicate acceptance ID');
  for (const item of cases) {
    assert.match(item.id, /^AC-[0-9]+$/);
    assert.ok(storyIds.has(item.story) && Object.hasOwn(item, 'input') && Object.hasOwn(item, 'expected'),
      'Invalid acceptance mapping');
  }
  for (const id of storyIds) assert.ok(cases.some(item => item.story === id), 'Story lacks independent acceptance');
  const snapshot = { calm, likec4: likec4.replaceAll('\r\n', '\n') };
  const impact = planArchitecture(previous, snapshot);
  approveArchitectureChanges(product, impact);
  const affectedStories = product.stories.filter(story => story.nodes.some(node => impact.affectedNodes.includes(node)));
  const affectedAcceptance = cases.filter(item => affectedStories.some(story => story.id === item.story)).map(item => item.id);
  return { product, cases, snapshot, architecture: { calm, impact, affectedAcceptance },
    requirementsSha256: digest({ product, cases, snapshot }) };
}

async function main() {
  assert.ok(['produce-initial', 'produce-next', 'verify', 'exercise'].includes(mode) && directory && input && output,
    'Usage: agent-delivery.mjs produce-initial|produce-next|verify|exercise PRODUCT_ROOT INPUT OUTPUT');
  const source = process.env.GITHUB_SHA;
  assert.match(source ?? '', /^[a-f0-9]{40}$/, 'Trusted source commit required');
  const run = process.env.GITHUB_RUN_ID;
  assert.match(run ?? '', /^[1-9][0-9]*$/, 'Trusted workflow run required');
  const capabilityLockSha256 = createHash('sha256').update(await readFile('apm.lock.yaml')).digest('hex');
  const initial = await readRevision('initial');
  const next = await readRevision('next', initial.snapshot);
  assert.equal(next.product.id, initial.product.id, 'Revision changed product identity');
  const revisions = { initial, next };
  const check = (revision, candidate) => verifyCandidate(revision.product, revision.cases, candidate);

  const identity = { source, run, product: initial.product.id,
    requirementsSha256: initial.requirementsSha256, capabilityLockSha256 };
  const produce = (name, previous, record) => produceRevision(revisions[name], previous, {
    agent: callCopilot, check, record: event => record({ revision: name, ...event }),
    adviseRepair: state => requestJevRepair(process.env.FORGE_JEV_TOKEN, fetch, { state }),
  });

  if (mode === 'produce-initial') {
    const audit = [];
    const accepted = await produce('initial', null, event => audit.push(event));
    await write(output, createCheckpoint(identity, accepted, audit));
  } else if (mode === 'produce-next') {
    const checkpoint = readCheckpoint(await json(input), identity);
    const previous = acceptSource(initial.product, { files: checkpoint.candidate.candidate });
    assert.ok((await check(initial, previous)).passed, 'Resumed checkpoint failed preflight');
    const audit = join(dirname(output), 'agent-audit.jsonl');
    const record = event => appendFile(audit, JSON.stringify(event) + '\n');
    for (const event of checkpoint.audit) await record(event);
    const accepted = await produce('next', previous, record);
    const candidates = { initial: checkpoint.candidate, next: accepted };
    assert.notEqual(digest(previous), digest(accepted.candidate), 'Agent did not evolve the source');
    await write(output, { product: identity.product, source, run, capabilityLockSha256, candidates });
  } else {
    const bundleBytes = await readFile(input);
    const bundle = JSON.parse(bundleBytes);
    assert.equal(bundle.product, initial.product.id, 'Bundle product mismatch');
    assert.equal(bundle.source, source, 'Bundle source commit mismatch');
    assert.equal(bundle.run, run, 'Bundle workflow run mismatch');
    assert.equal(bundle.capabilityLockSha256, capabilityLockSha256, 'Bundle capability lock mismatch');
    const snapshots = {};
    const evidence = {};
    for (const [name, revision] of Object.entries(revisions)) {
      const candidate = acceptSource(revision.product, { files: bundle.candidates[name]?.candidate });
      snapshots[name] = { product: revision.product, cases: revision.cases, candidate };
      if (mode === 'verify') {
        const acceptance = await check(revision, candidate);
        assert.ok(acceptance.passed, 'Independent acceptance failed for ' + name + ': ' +
          acceptance.checks.filter(item => !item.passed).map(item => item.id).join(', '));
        evidence[name] = { acceptance, candidateSha256: digest(candidate),
          requirementsSha256: revision.requirementsSha256, architecture: revision.architecture };
      } else {
        const verified = bundle.evidence[name];
        assert.equal(verified.candidateSha256, digest(candidate), 'Authenticated source bytes changed');
        assert.equal(verified.requirementsSha256, revision.requirementsSha256, 'Authenticated requirements changed');
        assert.equal(verified.acceptance.passed, true, 'Missing independent acceptance');
      }
    }
    assert.notEqual(digest(snapshots.initial.candidate), digest(snapshots.next.candidate), 'Missing source evolution');
    if (mode === 'verify') {
      const authorship = verifyAgentAudit(await readFile(join(dirname(input), 'agent-audit.jsonl'), 'utf8'),
        bundle.candidates, { requireRepairPolicy: true });
      await write(output, { product: initial.product.id, source, run, capabilityLockSha256, candidates: bundle.candidates, evidence, authorship });
    } else {
      assert.match(bundle.authorship?.sha256 ?? '', /^[a-f0-9]{64}$/, 'Missing attested agent audit digest');
      const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');
      const recovery = await exerciseRecovery(snapshots).catch(async error => {
        if (error.evidence) await write(output, { product: initial.product.id, source, bundleSha256, recovery: error.evidence });
        throw error;
      });
      assert.equal(recovery.passed, true, 'Isolated recovery failed');
      await write(output, { product: initial.product.id, source, bundleSha256, recovery });
    }
  }
}

try {
  await main();
} catch (error) {
  // Assertion objects and parser errors can contain raw agent output. Log
  // authored diagnostics only. The raw source must pass scanning before upload.
  const explicit = error.code === 'ERR_ASSERTION' && error.generatedMessage === false;
  const processFailure = /^Copilot (?:plan|code|test|review|repair) failed \([A-Za-z0-9_-]+\)$/.test(error.message);
  process.stderr.write('Agent delivery failed: ' +
    (explicit || processFailure ? error.message : 'invalid input, response, or worker execution') + '\n');
  process.exitCode = 1;
}
