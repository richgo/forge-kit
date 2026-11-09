#!/usr/bin/env bash
set -euo pipefail
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
bash factory/validate-calm.sh architecture/slice.json > "$scratch/direct.json"
bash factory/validate-calm.sh test/fixtures/delegated/architecture.json > "$scratch/delegated.json"
# Produce a valid CALM document with a second, disconnected service.
node --input-type=module - "$scratch/orphan.json" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const calm = JSON.parse(readFileSync('architecture/slice.json'));
calm.nodes.push({ ...calm.nodes[0], 'unique-id': 'unconnected' });
writeFileSync(process.argv[2], JSON.stringify(calm));
JS
if bash factory/validate-calm.sh "$scratch/orphan.json" > "$scratch/orphan-report.json" 2> "$scratch/orphan.log"; then
  echo 'CALM accepted a disconnected multi-node architecture' >&2
  exit 1
fi
grep -q 'CALM validation reported an unexpected warning' "$scratch/orphan.log"
