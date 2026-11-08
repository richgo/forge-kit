#!/usr/bin/env bash
set -euo pipefail
apm="${1:-apm}"
apm="$(command -v "$apm")"
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir "$scratch/project"
cp apm.yml "$scratch/project/"
(
  cd "$scratch/project"
  if "$apm" install --target copilot --frozen > "$scratch/no-lock.log" 2>&1; then
    echo 'Frozen install succeeded without a lock' >&2
    exit 1
  fi
  grep -Fq -- '--frozen requires apm.lock.yaml to exist' "$scratch/no-lock.log"
)
cp apm.lock.yaml "$scratch/project/"
(
  cd "$scratch/project"
  "$apm" install --target copilot --frozen
  "$apm" audit --ci
  printf '\nTampered after the verified install.\n' >> .agents/skills/forge-acceptance/SKILL.md
  if "$apm" audit --ci > "$scratch/tampered.log" 2>&1; then
    echo 'Audit accepted a changed installed skill' >&2
    exit 1
  fi
  grep -Eiq 'hash drift|drift detected|hash mismatch|changed' "$scratch/tampered.log"
)
