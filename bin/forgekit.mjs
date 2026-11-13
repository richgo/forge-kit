#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { validateOpenSpec } from './openspec.mjs';

const usage = 'Usage: forgekit init [--github-actions]\n       forgekit openspec validate [--workspace PATH] [--tool PATH] [--optional]';
const blueprint = new URL('../blueprint/', import.meta.url);
const caller = [
  'name: ForgeKit',
  'on: workflow_dispatch',
  'permissions: {}',
  'jobs:',
  '  change:',
  '    uses: richgo/forge-kit/.github/workflows/apmx-factory.yml@2c4054c67e09573da767bc1d76009fe8e3f4559d',
  '    permissions:',
  '      contents: read',
  '      attestations: write',
  '      id-token: write',
  '    secrets:',
  '      COPILOT_GITHUB_TOKEN: ${{ secrets.COPILOT_GITHUB_TOKEN }}',
  '',
].join('\n');

function ignoredPaths(root, paths) {
  const result = spawnSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
    cwd: root,
    encoding: 'utf8',
    input: paths.map(path => path + '\0').join(''),
  });
  if (result.error) throw result.error;
  if (![0, 1].includes(result.status)) throw new Error(result.stderr.trim() || 'Could not check Git ignore rules');
  return new Set(result.stdout.split('\0').filter(Boolean));
}

function init(hosted) {
  const git = option => execFileSync('git', ['rev-parse', option], { encoding: 'utf8' }).trim();
  const root = git('--show-toplevel');
  if (git('--show-prefix')) throw new Error('Run forgekit init from the application repository root');

  const directories = ['specs', '.forge', ...(hosted ? ['.github', '.github/workflows'] : [])];
  const files = ['specs/product-requirements.md', 'request.md', '.forge/verify-change']
    .map(path => ({ path, bytes: readFileSync(new URL(path, blueprint)) }));
  if (hosted) files.push({ path: '.github/workflows/forgekit.yml', bytes: Buffer.from(caller) });

  const stat = path => lstatSync(join(root, path), { throwIfNoEntry: false });
  if (stat('product-requirements.md')) {
    throw new Error('Move product-requirements.md to specs/product-requirements.md before upgrading ForgeKit. See the blueprint migration guide.');
  }
  for (const path of directories) {
    const entry = stat(path);
    if (entry && !entry.isDirectory()) throw new Error('Expected a directory at ' + path);
  }
  const missing = files.filter(({ path, bytes }) => {
    const entry = stat(path);
    if (!entry) return true;
    if (!entry.isFile() || !readFileSync(join(root, path)).equals(bytes)) {
      throw new Error('Review the existing ' + path + ' before initializing ForgeKit');
    }
    return false;
  });

  const targets = files.map(({ path }) => path);
  const ignored = ignoredPaths(root, [...directories.map(path => path + '/'), ...targets, '.gitignore']);
  const hiddenTargets = targets.filter(path => ignored.has(path));
  const rules = directories.flatMap(path =>
    ignored.has(path + '/') && hiddenTargets.some(target => target.startsWith(path + '/')) ?
      ['!/' + path + '/', '/' + path + '/*'] : []);
  rules.push(...hiddenTargets.map(path => '!/' + path));
  if (rules.length && ignored.has('.gitignore')) rules.push('!/.gitignore');
  const ignorePath = join(root, '.gitignore');
  let originalIgnore;
  const ignoreEntry = rules.length ? stat('.gitignore') : undefined;
  if (ignoreEntry) {
    if (!ignoreEntry.isFile()) throw new Error('Expected a regular .gitignore file');
    originalIgnore = readFileSync(ignorePath);
  }
  let ignoreUpdated = false;
  const createdDirectories = [];
  const createdFiles = [];
  try {
    for (const path of directories) {
      if (!stat(path)) {
        mkdirSync(join(root, path));
        createdDirectories.push(path);
      }
    }
    for (const { path, bytes } of missing) {
      const file = openSync(join(root, path), 'wx', path === '.forge/verify-change' ? 0o755 : 0o644);
      createdFiles.push(path);
      try {
        writeFileSync(file, bytes);
      } finally {
        closeSync(file);
      }
    }
    if (rules.length) {
      const file = openSync(ignorePath, originalIgnore ? 'r+' : 'wx');
      ignoreUpdated = true;
      try {
        const suffix = Buffer.from('\n# ForgeKit project inputs\n' + rules.join('\n') + '\n');
        writeFileSync(file, Buffer.concat([originalIgnore ?? Buffer.alloc(0), suffix]));
      } finally {
        closeSync(file);
      }
      const hidden = ignoredPaths(root, targets);
      if (hidden.size) throw new Error('Repository ignore rules still hide ' + [...hidden].join(', '));
    }
  } catch (error) {
    if (ignoreUpdated && originalIgnore) writeFileSync(ignorePath, originalIgnore);
    else if (ignoreUpdated && stat('.gitignore')) unlinkSync(ignorePath);
    for (const path of createdFiles.reverse()) unlinkSync(join(root, path));
    for (const path of createdDirectories.reverse()) rmdirSync(join(root, path));
    throw error;
  }

  for (const path of createdFiles) console.log('Created ' + path);
  if (ignoreUpdated) console.log('Updated .gitignore with scoped ForgeKit exceptions.');
  if (!createdFiles.length) console.log('ForgeKit blueprint already installed.');
  console.log('Review the requirements and request, then configure .forge/verify-change with the application checks.');
}

const [command, option, ...rest] = process.argv.slice(2);
try {
  if (command === '--help' || (command === 'init' && option === '--help')) {
    console.log(usage);
  } else if (command === 'init' && (option === undefined || option === '--github-actions') && !rest.length) {
    init(option === '--github-actions');
  } else if (command === 'openspec' && option === 'validate') {
    const { values } = parseArgs({ args: rest, options: {
      workspace: { type: 'string', default: '.' },
      tool: { type: 'string' },
      optional: { type: 'boolean' },
    } });
    console.log(JSON.stringify(await validateOpenSpec(values.workspace, values)));
  } else {
    throw new Error(usage);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
