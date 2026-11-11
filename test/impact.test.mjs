import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rmdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { planImpact } from '../factory/impact.mjs';
import { buildWebsite } from '../factory/website.mjs';
import { readProductRequirements } from '../factory/requirements.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = (...args) => spawnSync(process.execPath, ['factory/impact.mjs', ...args], { cwd: root, encoding: 'utf8' });

test('the impact CLI generates both Trail Desk models and scopes the step-free release', () => {
  const result = cli(
    '--before-requirements', 'examples/trail-desk/baseline/product-requirements.md',
    '--after-requirements', 'examples/trail-desk/step-free/product-requirements.md',
  );
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.deepEqual(plan.models, {
    before: { source: 'generated', view: 'landscape' },
    after: { source: 'generated', view: 'landscape' },
  });
  assert.deepEqual(plan.changes.nodes, [{ id: 'step_free_filter', change: 'added' }]);
  assert.deepEqual(plan.scope.nodes, ['browser', 'step_free_filter', 'visitor']);
  assert.deepEqual(plan.scope.stories.map(({ id }) => id), ['STORY-102']);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-102', 'AC-103']);
});

const trailDesk = async version => {
  const { document: requirements } = await readProductRequirements(join(root, 'examples', 'trail-desk', version, 'product-requirements.md'), { website: true });
  const { architecture: calm, view } = buildWebsite(requirements);
  return { requirements, calm, view };
};

test('the impact CLI scopes an authored readiness delegation to its existing story', () => {
  const result = cli(
    '--before-requirements', 'examples/product-requirements.md',
    '--before-calm', 'architecture/slice.json',
    '--before-likec4', 'architecture/slice.c4',
    '--after-requirements', 'examples/product-requirements.md',
    '--after-calm', 'test/fixtures/delegated/architecture.json',
    '--after-likec4', 'test/fixtures/delegated/architecture.c4',
  );
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.deepEqual(plan.models.before, { source: 'authored', view: 'index' });
  assert.deepEqual(plan.changes.nodes, [
    { id: 'health_probe', change: 'changed' },
    { id: 'readiness_worker', change: 'added' },
  ]);
  assert.deepEqual(plan.changes.relationships, [{
    id: 'readiness-delegation',
    change: 'added',
    before: null,
    after: { source: 'health_probe', destination: 'readiness_worker' },
  }]);
  assert.deepEqual(plan.changes.stories, []);
  assert.deepEqual(plan.scope.stories, [{
    id: 'STORY-001', owners: { before: 'health_probe', after: 'health_probe' }, reasons: ['architecture'],
  }]);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-001', 'AC-002']);
});

test('a changed catalog reaches all transitive consumers even when the graph has a cycle', async () => {
  const before = await trailDesk('current');
  before.calm.relationships.push({
    'unique-id': 'catalog-visitor',
    'relationship-type': { connects: { source: { node: 'trail_catalog' }, destination: { node: 'visitor' } } },
  });
  before.view = before.view.replace('\n}\nviews', '\n  trail_catalog -> visitor\n}\nviews');
  const after = structuredClone(before);
  after.calm.nodes.find(node => node['unique-id'] === 'trail_catalog').description = 'Catalog description changed.';
  const plan = planImpact(before, after);
  assert.deepEqual(plan.scope.architectureSeeds, ['trail_catalog']);
  assert.deepEqual(plan.scope.architectureConsumers.after, ['browser', 'distance_sort', 'pages', 'step_free_filter', 'trail_catalog', 'visitor']);
  assert.deepEqual(plan.scope.stories.map(({ id }) => id), ['STORY-101', 'STORY-102', 'STORY-103']);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-101', 'AC-102', 'AC-103', 'AC-104', 'AC-105', 'AC-106', 'AC-107']);
});

test('changing only a relationship starts the closure at its consumer', async () => {
  const before = await trailDesk('step-free');
  const after = structuredClone(before);
  const relationship = after.calm.relationships.find(edge => edge['unique-id'] === 'step_free_filter-trail_catalog');
  after.view = after.view.replace(relationship.description, 'Uses the catalog access metadata.');
  relationship.description = 'Uses the catalog access metadata.';
  const plan = planImpact(before, after);
  assert.deepEqual(plan.changes.nodes, []);
  assert.deepEqual(plan.scope.architectureSeeds, ['step_free_filter']);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-102', 'AC-103']);
});

test('removal keeps prior impact and reports retired acceptance separately', async () => {
  const plan = planImpact(await trailDesk('step-free'), await trailDesk('baseline'));
  assert.deepEqual(plan.scope.architectureConsumers, {
    before: ['browser', 'step_free_filter', 'visitor'],
    after: ['browser', 'visitor'],
  });
  assert.deepEqual(plan.scope.stories.map(({ id, owners }) => ({ id, owners })), [{
    id: 'STORY-102', owners: { before: 'step_free_filter', after: null },
  }]);
  assert.deepEqual(plan.scope.acceptanceToRun, []);
  assert.deepEqual(plan.scope.acceptanceRemoved, ['AC-102', 'AC-103']);
});

test('acceptance-only edits preserve criterion IDs and leave unrelated criteria out of scope', async () => {
  const before = await trailDesk('step-free');
  const after = structuredClone(before);
  const filterStory = after.requirements.epics[0].features[1].stories[0];
  filterStory.acceptanceCriteria[0].given = 'A visitor can see the entire trail catalog.';
  const plan = planImpact(before, after);
  assert.deepEqual(plan.changes.stories, []);
  assert.deepEqual(plan.changes.acceptance, [{ id: 'AC-102', change: 'changed' }]);
  assert.deepEqual(plan.scope.architectureSeeds, []);
  assert.deepEqual(plan.scope.stories, [{
    id: 'STORY-102', owners: { before: 'step_free_filter', after: 'step_free_filter' }, reasons: ['acceptance'],
  }]);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-102']);
});

test('edits to shared product data scope every live acceptance criterion', async () => {
  const before = await trailDesk('step-free');
  const after = structuredClone(before);
  after.requirements.trails[0].description = 'Catalog copy has changed.';
  const plan = planImpact(before, after);
  assert.deepEqual(plan.changes.product, [{ id: 'trails', change: 'changed' }]);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-101', 'AC-102', 'AC-103']);
});

test('the planner reports a LikeC4 landscape rename without changing acceptance scope', async () => {
  const before = await trailDesk('baseline');
  const after = structuredClone(before);
  after.view = after.view.replace('view landscape', 'view catalog');
  const plan = planImpact(before, after);
  assert.deepEqual(plan.changes.views, [{ id: 'catalog', change: 'added' }, { id: 'landscape', change: 'removed' }]);
  assert.deepEqual(plan.scope.acceptanceToRun, []);
});

test('reordering graph and requirement entries produces an empty scope', async () => {
  const before = await trailDesk('current');
  const after = structuredClone(before);
  after.calm.nodes.reverse();
  after.calm.relationships.reverse();
  after.requirements.epics[0].features.reverse();
  after.requirements.epics[0].features[0].stories[0].acceptanceCriteria.reverse();
  const plan = planImpact(before, after);
  assert.ok(Object.values(plan.changes).every(changes => changes.length === 0));
  assert.deepEqual(plan.scope.stories, []);
  assert.deepEqual(plan.scope.acceptanceToRun, []);
});

test('the CLI rejects an authored LikeC4 topology that disagrees with CALM without emitting a plan', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'forge-impact-'));
  const view = join(scratch, 'architecture.c4');
  try {
    const original = await readFile(join(root, 'test/fixtures/delegated/architecture.c4'), 'utf8');
    await writeFile(view, original.replace('health_probe -> readiness_worker', 'readiness_worker -> health_probe'));
    const result = cli(
      '--before-requirements', 'examples/product-requirements.md',
      '--before-calm', 'architecture/slice.json',
      '--before-likec4', 'architecture/slice.c4',
      '--after-requirements', 'examples/product-requirements.md',
      '--after-calm', 'test/fixtures/delegated/architecture.json',
      '--after-likec4', view,
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /LikeC4 relationships differ from CALM/);
  } finally {
    await unlink(view).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    await rmdir(scratch);
  }
});

test('invalid traceability and unsupported relationship shapes fail closed', async () => {
  const before = await trailDesk('baseline');
  const after = structuredClone(before);
  const story = after.requirements.epics[0].features[0].stories[0];
  story.architectureNode = 'missing';
  assert.throws(() => planImpact(before, after), /Unknown CALM owner for STORY-101/);
  story.architectureNode = 'trail_catalog';
  story.acceptanceCriteria.push(story.acceptanceCriteria[0]);
  assert.throws(() => planImpact(before, after), /Duplicate acceptance ID AC-101/);
  after.calm.relationships[0]['relationship-type'] = { composedOf: { container: 'visitor', nodes: ['browser'] } };
  assert.throws(() => planImpact(before, after), /Unsupported CALM relationship type/);
});

test('IDs must be strings even when an array would coerce to a valid ID', async () => {
  const before = await trailDesk('baseline');
  const after = structuredClone(before);
  after.requirements.epics[0].features[0].stories[0].acceptanceCriteria[0].id = ['AC-101'];
  assert.throws(() => planImpact(before, after), /Invalid acceptance criterion/);
});

test('a supplied blank CALM path fails without falling back to generation', () => {
  const result = cli(
    '--before-requirements', 'examples/trail-desk/baseline/product-requirements.md',
    '--after-requirements', 'examples/trail-desk/baseline/product-requirements.md',
    '--before-calm=', '--before-likec4=',
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Empty --before-calm/);
});

test('changing an acceptance criterion reaches consumers even without a topology edit', async () => {
  const before = await trailDesk('current');
  const after = structuredClone(before);
  after.requirements.epics[0].features[1].stories[0].acceptanceCriteria[0].given = 'Start with all trails visible.';
  const plan = planImpact(before, after);
  assert.deepEqual(plan.scope.architectureSeeds, []);
  assert.deepEqual(plan.scope.requirementSeeds, ['step_free_filter']);
  assert.deepEqual(plan.scope.stories.map(({ id, reasons }) => [id, reasons]), [
    ['STORY-102', ['acceptance']], ['STORY-103', ['dependency']],
  ]);
  assert.deepEqual(plan.scope.acceptanceToRun, ['AC-102', 'AC-104', 'AC-105', 'AC-106', 'AC-107']);
});

test('a stable acceptance ID cannot be reassigned to a different story', async () => {
  const before = await trailDesk('step-free');
  const after = structuredClone(before);
  const [catalog, filter] = after.requirements.epics[0].features;
  catalog.stories[0].acceptanceCriteria.push(filter.stories[0].acceptanceCriteria.shift());
  assert.throws(() => planImpact(before, after), /Acceptance ID moved to a different story: AC-102/);
});

test('the impact CLI scopes changes to authored acceptance prose', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'forge-markdown-impact-'));
  t.after(() => rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 }));
  const input = 'examples/product-requirements.md';
  const changed = join(scratch, 'product-requirements.md');
  const original = await readFile(input, 'utf8');
  await writeFile(changed, original.replace('Then the probe prints', 'Then standard output contains'));
  await copyFile('examples/acceptance.json', join(scratch, 'acceptance.json'));
  const result = cli(
    '--before-requirements', input,
    '--after-requirements', changed,
    '--before-calm', 'architecture/slice.json',
    '--after-calm', 'architecture/slice.json',
    '--before-likec4', 'architecture/slice.c4',
    '--after-likec4', 'architecture/slice.c4',
  );
  assert.equal(result.status, 0, result.stderr);
  const { changes, scope } = JSON.parse(result.stdout);
  assert.deepEqual(changes.acceptance, [{ id: 'AC-001', change: 'changed' }]);
  assert.deepEqual(scope.acceptanceToRun, ['AC-001']);
});
