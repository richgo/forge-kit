import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../factory/agent-catalog.mjs', import.meta.url));
const run = promisify(execFile);
const discover = async root => JSON.parse((await run(process.execPath, [cli, root])).stdout);

test('a new reviewed product is discovered without changing the workflow', async t => {
  const root = await mkdtemp(join(tmpdir(), 'forge-agent-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const id = 'another-product';
  for (const revision of ['initial', 'next']) {
    const directory = join(root, id, revision);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'product.json'), JSON.stringify({ id, runtime: 'python' }));
  }
  assert.deepEqual(await discover(root), { include: [{ product: id, runtime: 'python' }] });
  await writeFile(join(root, id, 'next', 'product.json'), JSON.stringify({ id, runtime: 'node' }));
  await assert.rejects(discover(root), /Runtime migration/);
});
