import { readFile } from 'node:fs/promises';
import { apmManifest, assemble, requestJevRepair } from './integrations.mjs';
import { run, verifyRun } from './slice.mjs';

const [command, output, flag, ...extra] = process.argv.slice(2);
try {
  if (command === 'assemble' && !flag && (!output || output === '--apm')) {
    const manifest = JSON.parse(await readFile(new URL('./packages.json', import.meta.url), 'utf8'));
    const assembly = assemble(manifest);
    if (output === '--apm') process.stdout.write(apmManifest(assembly.packages));
    else console.log(JSON.stringify(assembly, null, 2));
  } else if (command === 'run' && output && !extra.length && (!flag || flag === '--faulty-first-build')) {
    const jevToken = process.env.FORGE_JEV_TOKEN;
    const receipt = await run(output, {
      faultyFirstBuild: Boolean(flag),
      recommendRepair: jevToken ? () => requestJevRepair(jevToken) : undefined,
    });
    console.log(JSON.stringify(receipt.predicate, null, 2));
  } else if (command === 'verify' && output && !flag) {
    await verifyRun(output);
    console.log('Independent acceptance and receipt checks passed.');
  } else {
    throw new Error('Usage: node factory/cli.mjs assemble [--apm] | run OUTPUT [--faulty-first-build] | verify OUTPUT');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
