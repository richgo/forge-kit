import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { planProductChange } from './product-change.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: {
  manifest: { type: 'string' }, calm: { type: 'string' }, likec4: { type: 'string' },
  capabilities: { type: 'string' }, impact: { type: 'string' }, paths: { type: 'string' },
} });

try {
  const [manifest, architecture, likec4, capabilities] = await Promise.all(
    ['manifest', 'calm', 'likec4', 'capabilities'].map(key => readFile(values[key])),
  );
  const [impact, paths] = await Promise.all(['impact', 'paths'].map(async key =>
    values[key] ? JSON.parse(await readFile(values[key], 'utf8')) : undefined));
  const plan = planProductChange(JSON.parse(manifest), {
    architecture: JSON.parse(architecture),
    architectureSha256: sha(architecture),
    likec4Sha256: sha(likec4),
    capabilities: JSON.parse(capabilities),
    changedPaths: paths,
    impactedComponents: impact?.scope.nodes,
  });
  console.log(JSON.stringify(plan, null, 2));
} catch (error) {
  console.error('Product change planning failed. ' + error.message);
  process.exitCode = 1;
}
