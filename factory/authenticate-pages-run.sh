#!/usr/bin/env bash
# Fetch and authenticate a production release and its prior live observation.
set -euo pipefail
authenticate_release() {
  local run="$1" directory="$2" page_url="$3"
  [[ "$run" =~ ^[1-9][0-9]*$ && "$page_url" == https://* ]]
  mkdir "$directory"
  local sha signer archive
  local -a bundles
  sha="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run" | jq -er '
    select(.path == ".github/workflows/factory-e2e.yml" and .head_branch == "main" and
      .event == "workflow_dispatch" and .status == "completed" and .conclusion == "success") | .head_sha')"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]]
  signer="$(gh api "repos/$GITHUB_REPOSITORY/contents/factory/packages.json?ref=$sha" --jq .content |
    base64 --decode | jq -er '.capabilities.orchestration |
      select(.repository == "richgo/forge-kit-skills" and .workflow == ".github/workflows/forge-factory.lock.yml") | .ref')"
  [[ "$signer" =~ ^[0-9a-f]{40}$ ]]
  gh run download "$run" --repo "$GITHUB_REPOSITORY" --name factory-pages --dir "$directory/archive"
  gh run download "$run" --repo "$GITHUB_REPOSITORY" --name factory-pages-signature --dir "$directory/signature"
  gh run download "$run" --repo "$GITHUB_REPOSITORY" --name factory-pages-observation --dir "$directory/observation"
  bundles=("$directory"/signature/*.json)
  [[ "${#bundles[@]}" == 1 && -f "${bundles[0]}" ]]
  archive="$directory/archive/artifact.tar"
  gh attestation verify "$archive" --repo "$GITHUB_REPOSITORY" --bundle "${bundles[0]}" \
    --signer-workflow richgo/forge-kit-skills/.github/workflows/forge-factory-worker.yml \
    --signer-digest "$signer" --source-ref refs/heads/main --source-digest "$sha" \
    --deny-self-hosted-runners --predicate-type https://github.com/richgo/forge-kit/attestations/pages-release/v1 \
    --format json > "$directory/verified-signature.json"
  jq -e --arg source "$sha" '
    any(.[].verificationResult.statement.predicate;
      .source == $source and
      ([.apmLock, .apmModules, .apmxReceipt, .requirementsVerification, .browserEvidence,
        .securityVerification, .impactPlan] | all(type == "string" and test("^[0-9a-f]{64}$"))))
  ' "$directory/verified-signature.json" > /dev/null
  tar -xOf "$archive" ./release.json > "$directory/release.json"
  jq -e --arg source "$sha" '.source == $source' "$directory/release.json" > /dev/null
  jq -e --arg url "$page_url" --slurpfile manifest "$directory/release.json" '
    .observed == "passed" and .url == $url and del(.url, .observed) == $manifest[0]
  ' "$directory/observation/observed.json" > /dev/null
  sha256sum "$archive" | cut -d ' ' -f1 > "$directory/archive-sha256"
}

page_url="$1"
evidence="$2"
[[ "$CANDIDATE_RUN" != "$BASELINE_RUN" ]]
mkdir "$evidence"
authenticate_release "$CANDIDATE_RUN" "$evidence/candidate" "$page_url"
authenticate_release "$BASELINE_RUN" "$evidence/baseline" "$page_url"
# The successful publisher retained the exact predecessor it qualified for rollback.
gh run download "$CANDIDATE_RUN" --repo "$GITHUB_REPOSITORY" \
  --name factory-pages-rollback --dir "$evidence/candidate/rollback"
cmp "$evidence/candidate/rollback/artifact.tar" "$evidence/baseline/archive/artifact.tar"
