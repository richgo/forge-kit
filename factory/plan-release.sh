#!/usr/bin/env bash
# Build the comparison model using the checked-out parent of the approved source.
set -euo pipefail
release="${1:?Supply a Trail Desk release}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
case "$release" in
  current|baseline|step-free) ;;
  *) echo 'Unknown Trail Desk release' >&2; exit 1 ;;
esac
target="examples/trail-desk/$release/product-requirements.md"
scratch="$(mktemp -d)"
prior_tree="$scratch/prior-source"
cleanup() {
  if [[ -f "$prior_tree/.git" ]]; then git worktree remove --force "$prior_tree"; fi
  rm -rf -- "$scratch"
}
trap cleanup EXIT
base="$(git rev-parse HEAD)"
builder="$root/factory/website.mjs"
prior="examples/trail-desk/baseline/product-requirements.md"
if [[ "$release" == current ]]; then
  if [[ -n "${ROLLBACK_RUN:-}" ]]; then
    [[ "$ROLLBACK_RUN" =~ ^[1-9][0-9]*$ && "$ROLLBACK_RUN" != "$GITHUB_RUN_ID" ]]
    base="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$ROLLBACK_RUN" | jq -er '
      select(.path == ".github/workflows/factory-e2e.yml" and .head_branch == "main" and
        .event == "workflow_dispatch" and .conclusion == "success") | .head_sha')"
    [[ "$base" =~ ^[0-9a-f]{40}$ ]]
    git fetch --no-tags --depth=1 origin "$base" >&2
  else
    base="$(git rev-parse HEAD^1)"
  fi
  git worktree add --detach "$prior_tree" "$base" >&2
  builder="$prior_tree/factory/website.mjs"
  prior="$prior_tree/$target"
  if [[ ! -f "$prior" ]]; then prior="$prior_tree/$(dirname "$target")/product-requirements.json"; fi
  if [[ ! -f "$prior" ]]; then prior="$prior_tree/examples/trail-desk/step-free/product-requirements.md"; fi
  if [[ ! -f "$prior" ]]; then prior="$prior_tree/examples/trail-desk/step-free/product-requirements.json"; fi
fi
unset GH_TOKEN
FORGE_REQUIREMENTS_PACKAGE="${FORGE_REQUIREMENTS_PACKAGE:-$root/apm_modules/richgo/forge-kit-skills/packages/requirements}" \
  node "$builder" build "$prior" "$scratch/prior-model"
node factory/impact.mjs \
  --before-requirements "$prior" --before-calm "$scratch/prior-model/architecture.json" \
  --before-likec4 "$scratch/prior-model/architecture.c4" --after-requirements "$target" |
  jq --arg base "$base" --arg source "$(git rev-parse HEAD)" '. + {base: $base, source: $source}'
