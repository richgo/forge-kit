import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { observeRuntime, planRuntimeRecovery } from './runtime-recovery.mjs';

const [mode, directory, url] = process.argv.slice(2);
const read = async name => JSON.parse(await readFile(directory + '/' + name + '/release.json', 'utf8'));
if (mode === 'freshness') {
  // The archive upload and issue claim can take time. Reconfirm immediately
  // before deployment under the Pages lock, without re-running the advisor.
  const result = await observeRuntime(url, await read('candidate'));
  await writeFile(directory + '/freshness.json', JSON.stringify({ result, at: new Date().toISOString() }));
  assert.equal(result, 'content-mismatch', 'The active candidate no longer qualifies for restoration');
} else {
  assert.ok(mode === 'detect' || mode === 'authorize');
  const advisor = mode === 'authorize' ? await import(pathToFileURL(process.env.FORGE_RUNTIME_ADVISOR)) : null;
  const result = await planRuntimeRecovery({
    url, candidate: await read('candidate'), baseline: await read('baseline'),
    attempted: mode === 'authorize' ? Number(process.env.FORGE_ATTEMPTED) : 0,
    advise: async state => advisor?.requestJevRuntime(process.env.FORGE_JEV_TOKEN, fetch, state) ?? null,
  });
  await writeFile(directory + '/' + mode + '.json', JSON.stringify(result, null, 2) + '\n');
  await appendFile(process.env.GITHUB_OUTPUT, 'action=' + result.action + '\n');
}
