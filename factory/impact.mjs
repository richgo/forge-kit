import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { buildWebsite } from './website.mjs';
import { readProductRequirements, requirementsPackage } from './requirements.mjs';

const entry = 'checks/impact.mjs';
const location = process.env.FORGE_ARCHITECTURE_PACKAGE;
const { planImpact } = await import(location ? pathToFileURL(join(location, entry)) :
  new URL('../apm_modules/richgo/forge-kit-skills/packages/architecture/' + entry, import.meta.url));

export { planImpact };

async function readJson(path) {
  const bytes = await readFile(path, 'utf8');
  try {
    return JSON.parse(bytes);
  } catch (error) {
    throw new Error('Invalid JSON in ' + path + '. ' + error.message, { cause: error });
  }
}

async function loadSnapshot(values, side) {
  const requirementsPath = values[side + '-requirements'];
  const calmPath = values[side + '-calm'];
  const viewPath = values[side + '-likec4'];
  assert.ok(requirementsPath, 'Missing --' + side + '-requirements');
  assert.equal(Boolean(calmPath), Boolean(viewPath), 'Provide both --' + side + '-calm and --' + side + '-likec4');
  const { document: requirements, files, identity } = await readProductRequirements(requirementsPath, {
    website: calmPath ? undefined : true,
  });
  let generated;
  if (!calmPath) {
    assert.equal(requirements?.product, 'Trail Desk', 'Model generation supports Trail Desk. Supply authored CALM and LikeC4 for other products.');
    generated = buildWebsite(requirements);
  }
  if (identity) {
    const { parseMarkdownRequirements } = await requirementsPackage('checks/markdown-requirements.mjs');
    const source = parseMarkdownRequirements(files['product-requirements.md']);
    const criteria = document => document.epics.flatMap(epic => epic.features.flatMap(feature =>
      feature.stories.flatMap(story => story.acceptanceCriteria)));
    const intent = new Map(criteria(source).map(({ id, ...criterion }) => [id, criterion]));
    for (const criterion of criteria(requirements)) criterion.intent = intent.get(criterion.id);
  }
  if (generated) return { requirements, calm: generated.architecture, view: generated.view, source: 'generated' };
  const [calm, view] = await Promise.all([readJson(calmPath), readFile(viewPath, 'utf8')]);
  return { requirements, calm, view, source: 'authored' };
}

async function main(args) {
  const names = ['before-requirements', 'after-requirements', 'before-calm', 'after-calm', 'before-likec4', 'after-likec4'];
  const { values, tokens } = parseArgs({
    args, tokens: true, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])),
  });
  assert.equal(new Set(tokens.map(token => token.name)).size, tokens.length, 'Duplicate CLI option');
  for (const [name, value] of Object.entries(values)) assert.ok(value.trim(), 'Empty --' + name);
  const [before, after] = await Promise.all([loadSnapshot(values, 'before'), loadSnapshot(values, 'after')]);
  process.stdout.write(JSON.stringify(planImpact(before, after), null, 2) + '\n');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    console.error('Impact planning failed. ' + error.message);
    process.exitCode = 1;
  });
}
