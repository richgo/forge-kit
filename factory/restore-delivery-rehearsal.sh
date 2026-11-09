#!/usr/bin/env bash
# A rehearsal-only bridge from the separately qualified Phase 2 source.
set -euo pipefail
[[ "$GITHUB_REPOSITORY" == richgo/forge-kit && "$FORGE_REPLAY_DRILL" == true ]]
[[ "$PRODUCT" =~ ^(trail-desk|stock-ledger)$ ]]
run=42686477934
source=fff9fd7a772929adffa3519cf5984ff0fde47606
mkdir replay
gh run download "$run" --repo "$GITHUB_REPOSITORY" --name "agent-verified-$PRODUCT" --dir replay
gh run download "$run" --repo "$GITHUB_REPOSITORY" --name "agent-producer-$PRODUCT" --dir replay/producer
gh run download "$run" --repo "$GITHUB_REPOSITORY" --name "agent-signature-$PRODUCT" --dir replay/signature
bundles=(replay/signature/*.json)
[[ "${#bundles[@]}" == 1 && -f "${bundles[0]}" ]]
gh attestation verify replay/verified.json --bundle "${bundles[0]}" --repo "$GITHUB_REPOSITORY" \
  --signer-workflow "$GITHUB_REPOSITORY/.github/workflows/agent-delivery.yml" \
  --signer-digest "$source" --source-ref refs/heads/codex/phase-two --source-digest "$source" \
  --deny-self-hosted-runners \
  --predicate-type https://github.com/richgo/forge-kit/attestations/agent-product/v1 \
  --format json > replay/verified-signature.json
jq -e --arg source "$source" --arg product "$PRODUCT" '
  any(.[].verificationResult.statement.predicate;
    . == {product:$product, source:$source, acceptance:"independent"})
' replay/verified-signature.json >/dev/null
