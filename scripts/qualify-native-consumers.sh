#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

for language in python-api go-service typescript-web; do
  case "$language" in
    python-api) command -v python3 >/dev/null ;;
    go-service) command -v go >/dev/null ;;
    typescript-web) command -v tsc >/dev/null; command -v node >/dev/null ;;
  esac

  work="$tmp/$language"
  mkdir -p "$work"
  cp -R "$root/examples/consumers/$language/." "$work/"
  (
    cd "$work"
    git init -q
    git config user.email "fixture@invalid.example"
    git config user.name "ForgeKit fixture"
    git add .
    git commit -qm "Reviewed baseline"

    # Produce an actual candidate source patch against the reviewed baseline.
    python3 - "$language" <<'PY'
from pathlib import Path
import sys
language = sys.argv[1]
paths = {
    "python-api": Path("src/quote.py"),
    "go-service": Path("src/quote.go"),
    "typescript-web": Path("src/quote.ts"),
}
replacements = {
    "python-api": ("    return subtotal\n", "    return max(0, subtotal - discount)\n"),
    "go-service": ("    return subtotal, nil\n", "    if discount >= subtotal { return 0, nil }\n    return subtotal - discount, nil\n"),
    "typescript-web": ("  return subtotal;\n", "  return Math.max(0, subtotal - discount);\n"),
}
path = paths[language]
before, after = replacements[language]
content = path.read_text()
assert content.count(before) == 1, f"Unexpected baseline for {language}"
path.write_text(content.replace(before, after))
PY
    git diff -- src > "$tmp/$language.valid.diff"
    test -s "$tmp/$language.valid.diff"
    git checkout -q -- src

    # A good candidate must pass the actual protected checker and acceptance.
    bash .forge/verify-change "$tmp/$language.valid.diff"

    # The candidate must not be allowed to change the independent tests.
    printf '\n# malicious acceptance weakening\n' >> request.md
    git diff -- request.md > "$tmp/$language.protected.diff"
    git checkout -q -- request.md
    if bash .forge/verify-change "$tmp/$language.protected.diff"; then
      echo "FAIL: $language accepted protected file modification" >&2
      exit 1
    fi

    # Empty and absent patches must be rejected.
    : > "$tmp/$language.empty.diff"
    if bash .forge/verify-change "$tmp/$language.empty.diff"; then
      echo "FAIL: $language accepted empty patch" >&2
      exit 1
    fi
    echo "PASS: $language independent acceptance and protected-scope rejection"
  )
done
