import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { gradeReview } from '../evals/review.mjs';
import { apmManifest, assemble, requestJevRepair } from './integrations.mjs';
import { readRequirementsEvidence, readVerifiedReceipt, run } from './slice.mjs';

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'assemble' && (args.length === 0 || (args.length === 1 && args[0] === '--apm'))) {
    const manifest = JSON.parse(await readFile(new URL('./packages.json', import.meta.url), 'utf8'));
    const assembly = assemble(manifest);
    if (args.length) process.stdout.write(apmManifest(assembly.packages));
    else console.log(JSON.stringify(assembly, null, 2));
  } else if (['run', 'verify', 'grade', 'requirements-evidence'].includes(command)) {
    const options = { inputs: { type: 'string' }, story: { type: 'string' } };
    if (command === 'run') {
      options.fault = { type: 'string' };
      options['faulty-first-build'] = { type: 'boolean' };
    }
    if (command === 'grade') options.review = { type: 'string' };
    const { positionals, values } = parseArgs({ args, options, allowPositionals: true });
    const [output] = positionals;
    if (positionals.length !== 1) throw new Error('Supply exactly one output directory');
    const selection = { inputDirectory: values.inputs, story: values.story };
    if (command === 'run') {
      const jevToken = process.env.FORGE_JEV_TOKEN;
      const receipt = await run(output, {
        faultyFirstBuild: Boolean(values['faulty-first-build']),
        fault: values.fault,
        ...selection,
        recommendRepair: jevToken ? (state, { timeoutMs }) => requestJevRepair(jevToken, fetch, { state, timeoutMs }) : undefined,
      });
      console.log(JSON.stringify(receipt.predicate, null, 2));
    } else if (command === 'requirements-evidence') {
      console.log(JSON.stringify(await readRequirementsEvidence(output, selection), null, 2));
    } else {
      const receipt = await readVerifiedReceipt(output, selection);
      if (command === 'verify') {
        console.log('Independent acceptance and receipt checks passed.');
      } else {
        if (!values.review) throw new Error('Supply the review artifact with --review FILE');
        const report = JSON.parse(await readFile(values.review, 'utf8'));
        const result = gradeReview(receipt, report);
        console.log(JSON.stringify(result, null, 2));
        if (!result.passed) process.exitCode = 1;
      }
    }
  } else {
    throw new Error('Usage: node factory/cli.mjs assemble [--apm] | run|verify|grade OUTPUT [--inputs DIR] [--story ID] | requirements-evidence OUTPUT --inputs DIR --story ID');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
