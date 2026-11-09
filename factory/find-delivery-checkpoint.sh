#!/usr/bin/env bash
set -euo pipefail
name="$1"
[[ "$name" =~ ^agent-(initial|producer|interruption)-[a-z][a-z0-9-]*$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[1-9][0-9]*$ && "$GITHUB_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]]
if [[ "$GITHUB_RUN_ATTEMPT" == 1 ]]; then exit 0; fi
id="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/artifacts?name=$name&per_page=2" |
  jq -er --arg name "$name" '
    if .total_count == 0 then ""
    elif .total_count == 1 and .artifacts[0].expired == false and .artifacts[0].name == $name
      then .artifacts[0].id
    else error("Ambiguous or expired delivery checkpoint") end
  ')"
[[ -z "$id" || "$id" =~ ^[1-9][0-9]*$ ]]
printf 'id=%s\n' "$id" >> "$GITHUB_OUTPUT"
