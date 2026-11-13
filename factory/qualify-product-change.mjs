import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { verifyProductChange } from './product-change.mjs';

const { values } = parseArgs({ options: {
  plan: { type: 'string' },
  adapter: { type: 'string' },
} });

try {
  const plan = JSON.parse(await readFile(values.plan, 'utf8'));
  const adapter = await import(pathToFileURL(await realpath(values.adapter)));
  assert.equal(typeof adapter.createAdapters, 'function', 'Expected a reviewed product verification adapter');
  const verified = await verifyProductChange(plan, await adapter.createAdapters(plan));
  console.log(JSON.stringify(verified, null, 2));
} catch (error) {
  console.error('Product qualification failed. ' + error.message);
  process.exitCode = 1;
}
