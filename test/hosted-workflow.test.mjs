import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { assemble } from '../factory/assembly.mjs';

const workflow = await readFile(new URL('../.github/workflows/factory-e2e.yml', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../factory/packages.json', import.meta.url), 'utf8'));

test('production and no-deploy qualification share the same attested worker pin', () => {
  assert.ok(workflow.includes('uses: ' + assemble(manifest).orchestrator));
  assert.match(workflow, /github.ref == 'refs\/heads\/main' \|\| \(!inputs.publish_pages && github.actor == github.repository_owner\)/);
  assert.match(workflow, /rollback_run_id:/);
  assert.match(workflow, /allow_publish_without_rollback:/);
  assert.match(workflow, /name: factory-release-proof/);
  assert.match(workflow, /test -s proof\/verified-signature\.json/);
});
