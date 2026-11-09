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
while read -r id; do
  [[ "$id" =~ ^[1-9][0-9]*$ ]]
  status="$(gh api "$endpoint/$id/statuses?per_page=1" | jq -ec '.[0] | select(.log_url != null)')"
  log="$(jq -er .log_url <<< "$status")"
  # The current job's environment entry exists before any deploy step runs.
  if [[ "$log" == "$runs/$GITHUB_RUN_ID/job/"* ]]; then continue; fi
  jq -e --argjson id "$id" --arg source "$source" '
    any(.[]; .id == $id and .sha == $source and .ref == "main" and
      .performed_via_github_app.slug == "github-actions")
  ' <<< "$deployments" > /dev/null
  [[ "$log" == "$runs/$CANDIDATE_RUN/job/"* ]]
  jq -e --arg url "$url" 'select(.state == "success" and .environment_url == $url)' <<< "$status"
  exit
done <<< "$ids"
echo '::error::Could not bind the live Pages deployment to the candidate run' >&2
exit 1
