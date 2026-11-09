import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.argv[2];
assert.ok(root, 'Product catalog directory required');
const entries = await readdir(root, { withFileTypes: true });
assert.ok(entries.length > 0 && entries.length <= 8, 'Expected one to eight product directories');
const include = [];
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  assert.ok(entry.isDirectory(), 'Catalog entries must be product directories');
  assert.match(entry.name, /^[a-z][a-z0-9-]*$/);
  const read = async revision =>
    JSON.parse(await readFile(join(root, entry.name, revision, 'product.json'), 'utf8'));
  const [initial, next] = await Promise.all([read('initial'), read('next')]);
  assert.equal(initial.id, entry.name, 'Product ID must match its directory');
  assert.equal(next.id, initial.id, 'Product ID changed');
  assert.ok(['node', 'python'].includes(initial.runtime), 'Unsupported runtime');
  assert.equal(next.runtime, initial.runtime, 'Runtime migration requires a new execution adapter');
  include.push({ product: initial.id, runtime: initial.runtime });
}
console.log(JSON.stringify({ include }));
