#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# No dependency on a custom JavaScript factory is allowed in the copyable
# blueprint. Examples and legacy runtime are deliberately outside this scope.
if grep -RInE --include='*.md' --include='*.yml' --include='*.yaml' --include='*.sh'   'node[[:space:]]+(\.\./)*factory/[^[:space:]]+\.mjs|node[[:space:]]+(\.\./)*evals/[^[:space:]]+\.mjs' blueprint; then
  echo 'Blueprint calls legacy JavaScript factory runtime' >&2
  exit 1
fi
if find blueprint -type f -name '*.mjs' | grep -q .; then
  echo 'Blueprint embeds JavaScript factory runtime' >&2
  exit 1
fi
test -s blueprint/README.md
test -s blueprint/.forge/verify-change
grep -q 'apmx --from' blueprint/README.md
grep -q 'exit 2' blueprint/.forge/verify-change
echo 'Blueprint CLI-native static gate passed'
