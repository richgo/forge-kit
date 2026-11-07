import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { routeRepair } from './integrations.mjs';

const execute = promisify(execFile);
const schema = 'https://calm.finos.org/release/1.2/meta/calm.json';
const legacyPredicateType = 'https://github.com/richgo/forge-kit/attestations/bootstrap/v1';
const predicateType = 'https://github.com/richgo/forge-kit/attestations/bootstrap/v2';
const defaultInputs = ['examples/requirements.json', 'architecture/slice.json', 'architecture/slice.c4'];
const fixtureInputs = ['requirements.json', 'architecture.json', 'architecture.c4'];
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

function candidate(value, implementation) {
  const readiness = 'console.log(' + JSON.stringify(value) + ');\n';
  if (implementation.mode === 'direct') return readiness;
  const worker = readiness + 'console.error(' + JSON.stringify('worker:' + implementation.worker) + ');';
  return [
    "import { spawnSync } from 'node:child_process';",
    "const child = spawnSync(process.execPath, ['-e', " + JSON.stringify(worker) + "], { env: {}, timeout: 1500 });",
    'if (child.error) throw child.error;',
    'process.stdout.write(child.stdout);',
    'process.stderr.write(child.stderr);',
    'process.exitCode = child.status ?? 1;',
    '',
  ].join('\n');
}

export function validateArchitecture(calm, requirements, view) {
  assert.equal(calm.$schema, schema);
  assert.ok(Array.isArray(calm.nodes) && [1, 2].includes(calm.nodes.length), 'Expected one service or a service and worker');
  const ids = new Set();
  const nodes = calm.nodes.map(node => {
    const id = node['unique-id'];
    assert.match(id, /^[a-z][a-z0-9_]*$/);
    assert.ok(!ids.has(id), 'Duplicate CALM node');
    ids.add(id);
    assert.equal(node['node-type'], 'service');
    assert.match(node.name, /^[a-zA-Z0-9 ]+$/);
    assert.ok(typeof node.description === 'string' && node.description.trim());
    return "  " + id + " = service '" + node.name + "'";
  });
  assert.ok(ids.has(requirements.node), 'Requirement target must exist in CALM');
  let implementation = { mode: 'direct' };
  let edges = [];
  if (ids.size === 1) {
    assert.deepEqual(calm.relationships, []);
  } else {
    assert.ok(Array.isArray(calm.relationships) && calm.relationships.length === 1, 'Expected one CALM delegation');
    const [relationship] = calm.relationships;
    const worker = [...ids].find(id => id !== requirements.node);
    assert.ok(typeof relationship['unique-id'] === 'string' && relationship['unique-id'].trim());
    assert.deepEqual(relationship['relationship-type'], {
      connects: { source: { node: requirements.node }, destination: { node: worker } },
    }, 'CALM delegation must connect the requirement owner to its worker');
    implementation = { mode: 'delegated', worker };
    edges = ['  ' + requirements.node + ' -> ' + worker];
  }
  const projection = [
    'specification {', '  element service', '}', 'model {', ...nodes, ...edges,
    '}', 'views {', '  view index {', '    include *', '  }', '}',
  ].join('\n');
  assert.equal(view.trim(), projection, 'LikeC4 view must match the CALM projection');
  return implementation;
}

async function loadInputs(inputDirectory) {
  const names = inputDirectory ? fixtureInputs : defaultInputs;
  const data = await Promise.all(names.map(name => readFile(
    inputDirectory ? join(inputDirectory, name) : new URL('../' + name, import.meta.url)
  )));
  const [req, model, view] = data;
  const requirements = JSON.parse(req);
  assert.match(requirements.id, /^REQ-[0-9]+$/);
  assert.ok(typeof requirements.summary === 'string' && requirements.summary.trim());
  assert.match(requirements.expectedOutput, /^[a-z]{1,32}$/);
  return {
    requirements,
    implementation: validateArchitecture(JSON.parse(model), requirements, view.toString('utf8')),
    materials: names.map((name, index) => ({ name, digest: digest(data[index]) })),
  };
}

// Accept only the fixture templates with a constrained readiness value. The
// runtime assertion below independently checks what the accepted code does.
function allowedCandidate(bytes, implementation) {
  const source = bytes.toString('utf8');
  let worker = source;
  if (implementation.mode === 'delegated') {
    const arg = /'[-]e', ("(?:[^"\\]|\\.)*")\], \{ env:/.exec(source);
    if (!arg) return false;
    try {
      worker = JSON.parse(arg[1]);
    } catch {
      return false;
    }
  }
  const output = /^console\.log\("([a-z]{1,32})"\);\n/.exec(worker);
  return Boolean(output && bytes.equals(Buffer.from(candidate(output[1], implementation))));
}

function observationFor(requirements, implementation) {
  return {
    stdout: requirements.expectedOutput + '\n',
    stderr: implementation.mode === 'delegated' ? 'worker:' + implementation.worker + '\n' : '',
  };
}

async function observe(bytes, requirements, implementation) {
  assert.ok(allowedCandidate(bytes, implementation), 'Candidate is outside the architecture acceptance template');
  const observed = await execute(process.execPath, ['--input-type=module', '--eval', bytes.toString('utf8')], {
    env: {}, timeout: 3000, maxBuffer: 1024,
  });
  assert.deepEqual(observed, observationFor(requirements, implementation), 'Runtime acceptance does not match the requirement and architecture');
  return observed;
}

function statement({ materials, requirements, implementation }, artifact, stages, rejected, observation) {
  return {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'deployed.mjs', digest: digest(artifact) }],
    predicateType,
    predicate: {
      requirement: requirements.id, materials, stages, repairs: rejected.length,
      implementation, rejected, observation,
    },
  };
}

export async function run(output, {
  faultyFirstBuild = false,
  fault = faultyFirstBuild ? 'wrong-output-once' : undefined,
  inputDirectory,
  maxRepairs = 1,
  recommendRepair = () => ({ choice: 'retry-build', probability: 1 }),
} = {}) {
  assert.ok(maxRepairs === 0 || maxRepairs === 1, 'Fixture allows at most one repair');
  assert.ok(fault === undefined || ['wrong-output-once', 'wrong-output-always'].includes(fault), 'Unknown fixture fault');
  const stages = [];
  const advance = stage => {
    assert.ok(transitions[stages.at(-1) ?? 'start']?.includes(stage), 'Illegal stage transition');
    stages.push(stage);
  };
  advance('requirements');
  const input = await loadInputs(inputDirectory);
  const { requirements, implementation } = input;
  advance('architecture');
  await mkdir(output);
  const plan = { requirement: requirements.id, target: requirements.node, implementation, maxRepairs };
  await writeFile(join(output, 'plan.json'), asJson(plan), { flag: 'wx' });
  advance('plan');

  const buildPath = join(output, 'candidate.mjs');
  const deployedPath = join(output, 'deployed.mjs');
  const rejected = [];
  let repairs = 0;
  for (;;) {
    const inject = fault === 'wrong-output-always' || (fault === 'wrong-output-once' && repairs === 0);
    const wrongOutput = requirements.expectedOutput === 'broken' ? 'unavailable' : 'broken';
    advance('build');
    await writeFile(buildPath, candidate(inject ? wrongOutput : requirements.expectedOutput, implementation));
    advance('test');
    const built = await readFile(buildPath);
    try {
      await observe(built, requirements, implementation);
      break;
    } catch (error) {
      // Unexpected infrastructure failures are not eligible for build repair.
      if (error.code !== 'ERR_ASSERTION') throw error;
    }
    const name = repairs === 0 ? 'rejected.mjs' : 'rejected-2.mjs';
    await writeFile(join(output, name), built, { flag: 'wx' });
    rejected.push({ name, digest: digest(built) });
    let recommendation;
    if (repairs < maxRepairs) {
      try {
        recommendation = await recommendRepair();
      } catch {
        recommendation = null;
      }
    }
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
  let observation;
  try {
    observation = await observe(deployed, requirements, implementation);
    assert.ok(deployed.equals(await readFile(deployedPath)), 'Deployed bytes changed during observation');
  } catch (error) {
    advance('escalated');
    await writeFile(join(output, 'state.json'), asJson(stages));
    throw error;
  }
  advance('evidence');
  advance('review-ready');
  const receipt = statement(input, deployed, stages, rejected, observation);
  await writeFile(join(output, 'receipt.json'), asJson(receipt), { flag: 'wx' });
  return receipt;
}

export async function readVerifiedReceipt(output, { inputDirectory } = {}) {
  const input = await loadInputs(inputDirectory);
  const { requirements, implementation } = input;
  const receipt = JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8'));
  const deployed = await readFile(join(output, 'deployed.mjs'));
  assert.deepEqual(receipt.subject, [{ name: 'deployed.mjs', digest: digest(deployed) }], 'Artifact digest mismatch');
  const observed = await observe(deployed, requirements, implementation);
  assert.ok(deployed.equals(await readFile(join(output, 'deployed.mjs'))), 'Deployed bytes changed during verification');
  const repairs = receipt.predicate.repairs;
  assert.ok(repairs === 0 || repairs === 1, 'Invalid repair count');
  const stages = ['requirements', 'architecture', 'plan', 'build', 'test'];
  if (repairs) stages.push('repair', 'build', 'test');
  stages.push('deploy', 'observe', 'evidence', 'review-ready');
  if (receipt.predicateType === legacyPredicateType && !inputDirectory && implementation.mode === 'direct') {
    assert.deepEqual(receipt, {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'deployed.mjs', digest: digest(deployed) }],
      predicateType: legacyPredicateType,
      predicate: { requirement: requirements.id, materials: input.materials, stages, repairs },
    });
    return receipt;
  }
  const rejected = [];
  if (repairs) {
    const name = 'rejected.mjs';
    const bytes = await readFile(join(output, name));
    rejected.push({ name, digest: digest(bytes) });
    assert.deepEqual(receipt.predicate.rejected, rejected, 'Rejected candidate digest mismatch');
    await assert.rejects(observe(bytes, requirements, implementation), { code: 'ERR_ASSERTION' },
      'Rejected candidate satisfies acceptance');
  }
  assert.deepEqual(receipt, statement(input, deployed, stages, rejected, observed));
  return receipt;
}

export async function verifyRun(output, options) {
  await readVerifiedReceipt(output, options);
  return true;
}
