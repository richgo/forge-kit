#!/usr/bin/env bash
set -euo pipefail
model="${1:?Supply a CALM architecture file}"
report="$(mktemp)"
trap 'rm -f -- "$report"' EXIT
npx --yes --package @finos/calm-cli@1.68.0 calm validate -a "$model" --format json --output "$report"
# An intentionally standalone readiness service has no dependency to reference.
# Every other warning, and every schema or semantic error, still fails the gate.
node --input-type=module - "$model" "$report" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const [arch, result] = process.argv.slice(2).map(path => JSON.parse(readFileSync(path)));
assert.equal(result.hasErrors, false, 'CALM validation reported errors');
if (result.hasWarnings) {
  const [warning] = result.spectralSchemaValidationOutputs;
  assert.ok(arch.nodes.length === 1 && arch.relationships.length === 0 &&
    arch.nodes[0]['node-type'] === 'service' && result.jsonSchemaValidationOutputs.length === 0 &&
    result.spectralSchemaValidationOutputs.length === 1 &&
    warning.code === 'architecture-nodes-must-be-referenced' && warning.severity === 'warning',
  'CALM validation reported an unexpected warning');
}
JS
cat "$report"
