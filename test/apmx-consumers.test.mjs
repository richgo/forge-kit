import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('hosted qualification uses only pinned native APMX factory', async () => {
  const yaml = await readFile(new URL('../.github/workflows/apmx-consumers.yml', import.meta.url), 'utf8');
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /uses: \.\/\.github\/workflows\/apmx-factory\.yml/g);
  assert.equal((yaml.match(/uses: \.\/\.github\/workflows\/apmx-factory\.yml/g) || []).length, 3);
  for (const consumer of ['python-api', 'go-service', 'typescript-web']) {
    assert.ok(yaml.includes('workspace: examples/consumers/' + consumer));
  }
  assert.doesNotMatch(yaml, /node\s+factory\/|npm\s+run|deploy-pages|pages: write/);
  assert.match(yaml, /attestations: write/);
  assert.match(yaml, /id-token: write/);
  assert.match(yaml, /permissions: \{\}/);
  const factory = await readFile(new URL('../.github/workflows/apmx-factory.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(yaml, /^\s+request:/m);
  assert.doesNotMatch(factory, /^\s+request:/m);
});

test('every consumer has protected checker, source, request and acceptance tests', async () => {
  const roots = ['python-api', 'go-service', 'typescript-web'];
  for (const name of roots) {
    const base = new URL('../examples/consumers/' + name + '/', import.meta.url);
    const request = await readFile(new URL('request.md', base), 'utf8');
    const checker = await readFile(new URL('.forge/verify-change', base), 'utf8');
    const requirements = await readFile(new URL('specs/product-requirements.md', base), 'utf8');
    assert.match(request, /# Approved change request/);
    assert.match(request, /## Stories/);
    assert.match(request, /## Allowed source paths/);
    assert.match(requirements, /##### Acceptance AC-001/);
    assert.match(checker, /git apply --check/);
    assert.match(checker, /mktemp -d/);
    assert.match(checker, /Rejected protected or out-of-scope path/);
  }
});
