import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { routeRepair } from './integrations.mjs';

const execute = promisify(execFile);
const schema = 'https://calm.finos.org/release/1.2/meta/calm.json';
const predicateType = 'https://github.com/richgo/forge-kit/attestations/bootstrap/v1';
const inputs = ['examples/requirements.json', 'architecture/slice.json', 'architecture/slice.c4'];
const transitions = {
  start: ['requirements'],
  requirements: ['architecture'],
  architecture: ['plan'],
  plan: ['build'],
  build: ['test'],
  test: ['deploy', 'repair', 'escalated'],
  repair: ['build'],
  deploy: ['observe'],
  observe: ['evidence', 'escalated'],
  evidence: ['review-ready'],
};

const digest = bytes => ({ sha256: createHash('sha256').update(bytes).digest('hex') });
const asJson = data => JSON.stringify(data, null, 2) + '\n';
const candidate = value => 'console.log(' + JSON.stringify(value) + ');\n';

export function validateArchitecture(calm, requirements, view) {
  // This projection intentionally supports the single service shape in the example.
  assert.equal(calm.$schema, schema);
  assert.ok(Array.isArray(calm.nodes) && calm.nodes.length === 1);
  assert.deepEqual(calm.relationships, []);
  const [node] = calm.nodes;
  assert.equal(node['unique-id'], requirements.node, 'Requirement target must exist in CALM');
  assert.match(node['unique-id'], /^[a-z][a-z0-9_]*$/);
  assert.equal(node['node-type'], 'service');
  assert.match(node.name, /^[a-zA-Z0-9 ]+$/);
  assert.ok(typeof node.description === 'string' && node.description.trim());
  const projection = [
    'specification {', '  element service', '}', 'model {',
    "  " + node['unique-id'] + " = service '" + node.name + "'",
    '}', 'views {', '  view index {', '    include *', '  }', '}',
  ].join('\n');
  assert.equal(view.trim(), projection, 'LikeC4 view must match the CALM projection');
}

async function loadInputs() {
  const data = await Promise.all(inputs.map(name => readFile(new URL('../' + name, import.meta.url))));
  const [req, model, view] = data;
  const requirements = JSON.parse(req);
  assert.match(requirements.id, /^REQ-[0-9]+$/);
  assert.ok(typeof requirements.summary === 'string' && requirements.summary.trim());
  assert.match(requirements.expectedOutput, /^[a-z]{1,32}$/);
  return {
    requirements,
    calm: JSON.parse(model),
    view: view.toString('utf8'),
    materials: inputs.map((name, index) => ({ name, digest: digest(data[index]) })),
  };
}

// The checker compares exact bytes against an implementation-independent
// acceptance fixture. It never executes bytes received by verifyRun.
function acceptanceTest(bytes, requirements) {
  const match = /^console\.log\("([a-z]{1,32})"\);\n$/.exec(bytes.toString('utf8'));
  return match?.[1] === requirements.expectedOutput && bytes.equals(Buffer.from(match[0]));
}

function statement(materials, requirements, artifact, stages, repairs) {
  return {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'deployed.mjs', digest: digest(artifact) }],
    predicateType,
    predicate: { requirement: requirements.id, materials, stages, repairs },
  };
}

export async function run(output, {
  faultyFirstBuild = false,
  maxRepairs = 1,
  recommendRepair = () => ({ choice: 'retry-build', probability: 1 }),
} = {}) {
  assert.ok(maxRepairs === 0 || maxRepairs === 1, 'Fixture allows at most one repair');
  const stages = [];
  const advance = stage => {
    assert.ok(transitions[stages.at(-1) ?? 'start']?.includes(stage), 'Illegal stage transition');
    stages.push(stage);
  };
  const { requirements, calm, view, materials } = await loadInputs();
  advance('requirements');
  validateArchitecture(calm, requirements, view);
  advance('architecture');
  await mkdir(output);
  const plan = { requirement: requirements.id, target: requirements.node, maxRepairs };
  await writeFile(join(output, 'plan.json'), asJson(plan), { flag: 'wx' });
  advance('plan');

  const buildPath = join(output, 'candidate.mjs');
  const deployedPath = join(output, 'deployed.mjs');
  let repairs = 0;
  for (;;) {
    const value = faultyFirstBuild && repairs === 0 ? '' : requirements.expectedOutput;
    advance('build');
    await writeFile(buildPath, candidate(value));
    advance('test');
    if (acceptanceTest(await readFile(buildPath), requirements)) break;
    const recommendation = repairs < maxRepairs ? await recommendRepair() : null;
    if (routeRepair(recommendation, { used: repairs, limit: maxRepairs }) === 'escalate') {
      advance('escalated');
      await writeFile(join(output, 'state.json'), asJson(stages));
      throw new Error('Build rejected and repair denied by policy');
    }
    advance('repair');
    repairs++;
  }

  await copyFile(buildPath, deployedPath);
  advance('deploy');
  const deployed = await readFile(deployedPath);
  advance('observe');
  try {
    assert.ok(acceptanceTest(deployed, requirements), 'Deployed bytes failed acceptance');
    const observed = await execute(process.execPath, ['--input-type=module', '--eval', deployed.toString('utf8')], {
      env: {}, timeout: 3000, maxBuffer: 1024,
    });
    assert.equal(observed.stdout, requirements.expectedOutput + '\n');
    assert.ok(deployed.equals(await readFile(deployedPath)), 'Deployed bytes changed during observation');
  } catch (error) {
    advance('escalated');
    await writeFile(join(output, 'state.json'), asJson(stages));
    throw error;
  }
  advance('evidence');
  advance('review-ready');
  const receipt = statement(materials, requirements, deployed, stages, repairs);
  await writeFile(join(output, 'receipt.json'), asJson(receipt), { flag: 'wx' });
  return receipt;
}

export async function verifyRun(output) {
  const { requirements, calm, view, materials } = await loadInputs();
  validateArchitecture(calm, requirements, view);
  const receipt = JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8'));
  const deployed = await readFile(join(output, 'deployed.mjs'));
  assert.deepEqual(receipt.subject, [{ name: 'deployed.mjs', digest: digest(deployed) }], 'Artifact digest mismatch');
  assert.ok(acceptanceTest(deployed, requirements), 'Independent acceptance test rejected deployed bytes');
  const repairs = receipt.predicate.repairs;
  assert.ok(repairs === 0 || repairs === 1, 'Invalid repair count');
  const stages = ['requirements', 'architecture', 'plan', 'build', 'test'];
  if (repairs) stages.push('repair', 'build', 'test');
  stages.push('deploy', 'observe', 'evidence', 'review-ready');
  assert.deepEqual(receipt, statement(materials, requirements, deployed, stages, repairs));
  return true;
}
