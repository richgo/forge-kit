#!/usr/bin/env bash
# A CDN response may lag a newer deployment even while the Pages lock is held.
set -euo pipefail
url="$1"
manifest="$2"
[[ "$CANDIDATE_RUN" =~ ^[1-9][0-9]*$ && "$GITHUB_RUN_ID" =~ ^[1-9][0-9]*$ ]]
source="$(jq -er .source "$manifest")"
runs="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs"
endpoint="repos/$GITHUB_REPOSITORY/deployments"
deployments="$(gh api "$endpoint?environment=github-pages&per_page=10")"
ids="$(jq -ber '.[].id' <<< "$deployments")"
skipped_recovery=false
while read -r id; do
  [[ "$id" =~ ^[1-9][0-9]*$ ]]
  statuses="$(gh api "$endpoint/$id/statuses?per_page=10")"
  status="$(jq -ec '.[0] | select(.log_url != null)' <<< "$statuses")"
  log="$(jq -er .log_url <<< "$status")"
  [[ "$log" == "$runs/"* ]]
  path="${log#"$runs/"}"
  [[ "$path" =~ ^([1-9][0-9]*)/job/([1-9][0-9]*)$ ]]
  run="${BASH_REMATCH[1]}"
  job="${BASH_REMATCH[2]}"
  state="$(jq -er .state <<< "$status")"
  # Environment entries can exist even when the recovery job makes no deploy.
  if [[ "$run" == "$GITHUB_RUN_ID" && "$state" =~ ^(in_progress|pending|queued)$ ]]; then continue; fi
  if [[ "$run" != "$CANDIDATE_RUN" ]] &&
    gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run" | jq -e '
      .path == ".github/workflows/runtime-recovery.yml" and .head_branch == "main"
    ' >/dev/null &&
    gh api "repos/$GITHUB_REPOSITORY/actions/jobs/$job" | jq -e --argjson run "$run" '
      .run_id == $run and .status == "completed" and
      any(.steps[]; .name == "Deploy the authenticated predecessor" and .conclusion == "skipped")
    ' >/dev/null; then
    skipped_recovery=true
    continue
  fi
  [[ "$run" == "$CANDIDATE_RUN" ]]
  if [[ "$skipped_recovery" == true && "$state" == inactive ]]; then
    status="$(jq -ec 'map(select(.state != "inactive"))[0] | select(. != null)' <<< "$statuses")"
  fi
  jq -e --argjson id "$id" --arg source "$source" '
    any(.[]; .id == $id and .sha == $source and .ref == "main" and
      .performed_via_github_app.slug == "github-actions")
  ' <<< "$deployments" > /dev/null
  jq -e --arg url "$url" --arg log "$log" 'select(.state == "success" and .environment_url == $url and .log_url == $log)' <<< "$status"
  exit
done <<< "$ids"
echo '::error::Could not bind the live Pages deployment to the candidate run' >&2
exit 1
