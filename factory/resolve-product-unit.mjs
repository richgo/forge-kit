import assert from 'node:assert/strict';
import { appendFile, readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { validateProductPlan } from './product-change.mjs';

const { PRODUCT_PLAN: path, PRODUCT_UNIT: key, GITHUB_OUTPUT: output } = process.env;
try {
  assert.ok(path && key && output, 'Missing product plan, implementation unit or workflow output');
  const root = await realpath('.');
  const file = await realpath(resolve(root, path));
  assert.ok(file.startsWith(root + sep) && relative(root, file).endsWith('.json'),
    'Product plan must be a JSON file in this checkout');
  const plan = JSON.parse(await readFile(file, 'utf8'));
  validateProductPlan(plan);
  assert.ok(Object.hasOwn(plan.units, key) && plan.waves.flat().includes(key), 'Unit is outside the build plan');
  const { repository, revision, path: workspace } = plan.units[key].source;
  assert.match(repository, /^[a-z\d][a-z\d-]*\/[a-z\d_.-]+$/);
  assert.match(revision, /^[a-f0-9]{40}$/);
  assert.ok(workspace === '.' || /^[a-z\d_./-]+$/i.test(workspace) &&
    workspace.split('/').every(segment => segment && !segment.endsWith('.')), 'Invalid target workspace');
  await appendFile(output, ['repository=' + repository, 'revision=' + revision, 'workspace=' + workspace, ''].join('\n'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
