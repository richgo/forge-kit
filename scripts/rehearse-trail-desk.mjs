import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProductRequirements, requirementsPackage } from '../factory/requirements.mjs';
import { buildWebsite } from '../factory/website.mjs';

const examples = new URL('../examples/trail-desk/', import.meta.url);
const root = fileURLToPath(examples);
const [command, scenario, target] = process.argv.slice(2);
assert.ok(['prepare', 'rehearse'].includes(command) && ['miles', 'catalog-api'].includes(scenario) && target,
  'Usage: node scripts/rehearse-trail-desk.mjs prepare|rehearse miles|catalog-api NEW_DIRECTORY');
const scenarioFiles = join(root, 'rehearsals', scenario);
const sharedFiles = join(root, 'rehearsals', 'shared');
const isMiles = scenario === 'miles';

async function prepare(directory) {
  const { document, files } = await readProductRequirements(join(root, 'current', 'product-requirements.md'), { website: true });
  const baseline = buildWebsite(document);
  const checks = isMiles ? ['trail-desk.miles'] : JSON.parse(files['acceptance.json']).map(criterion => criterion.id);
  let { architecture, view } = baseline;
  let requirements = files['product-requirements.md'];
  if (isMiles) {
    const story = await readFile(join(scenarioFiles, 'story.md'), 'utf8');
    const [, ...fragment] = story.split('\n');
    const embeddedStory = fragment.join('\n').trim().replace(/^#{2,4} /gm, '#$&');
    requirements = Buffer.from(requirements.toString('utf8').trimEnd() + '\n\n' + embeddedStory + '\n');
  } else {
    const { architectureChange } = await import(new URL('rehearsals/catalog-api/architecture.mjs', examples));
    ({ architecture, view } = architectureChange(architecture, view));
  }

  const { parseMarkdownRequirements } = await requirementsPackage('checks/markdown-requirements.mjs');
  parseMarkdownRequirements(requirements);
  await mkdir(directory);
  await Promise.all([mkdir(join(directory, 'src')), mkdir(join(directory, '.forge'))]);
  await Promise.all([
    writeFile(join(directory, 'product-requirements.md'), requirements),
    writeFile(join(directory, 'catalog.json'), files['catalog.json']),
    writeFile(join(directory, 'acceptance.json'), files['acceptance.json']),
    writeFile(join(directory, 'architecture.json'), JSON.stringify(architecture, null, 2) + '\n'),
    writeFile(join(directory, 'architecture.c4'), view),
    writeFile(join(directory, 'src/index.html'), baseline.html),
    copyFile(join(sharedFiles, 'server.mjs'), join(directory, 'src/server.mjs')),
    copyFile(join(sharedFiles, 'verify-change'), join(directory, '.forge/verify-change')),
    copyFile(join(sharedFiles, 'verify.mjs'), join(directory, '.forge/verify.mjs')),
    copyFile(join(scenarioFiles, 'verify.mjs'), join(directory, '.forge/criteria.mjs')),
    copyFile(join(scenarioFiles, 'request.md'), join(directory, 'request.md')),
    writeFile(join(directory, '.forge/check.txt'), checks.join('\n') + '\n'),
  ]);
  return checks;
}

const directory = resolve(target);
if (command === 'prepare') {
  await prepare(directory);
} else {
  await mkdir(directory);
  const approved = join(directory, 'approved');
  const candidate = join(directory, 'candidate');
  const checks = await prepare(approved);
  await cp(approved, candidate, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: candidate });
  git('init', '-q');
  git('add', '--', 'src');
  const { implement } = await import(new URL('rehearsals/' + scenario + '/implement.mjs', examples));
  await implement(candidate);
  git('add', '-N', '--', 'src');
  const patch = join(directory, 'changes.diff');
  await writeFile(patch, git('diff', '--no-ext-diff', '--binary', '--', 'src'));
  execFileSync('bash', ['.forge/verify-change', patch, ...checks], { cwd: approved, stdio: 'inherit' });
}
