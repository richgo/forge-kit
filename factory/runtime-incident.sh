#!/usr/bin/env bash
# The runtime workflow serializes incident creation. Its privileged job also
# holds the publisher's Pages lock while it records a claim and deploys.
set -euo pipefail
endpoint="repos/$GITHUB_REPOSITORY/issues"
run_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
[[ "$CANDIDATE_RUN" =~ ^[1-9][0-9]*$ ]]
title="ForgeKit Pages incident for release run $CANDIDATE_RUN"
key="<!-- forgekit: runtime incident for run $CANDIDATE_RUN -->"
claim="<!-- forgekit: restoration-attempt-1 for run $CANDIDATE_RUN -->"
case "$1" in
  open)
    issue="$(gh api --paginate --slurp "$endpoint?state=all&per_page=100" |
      jq -er --arg key "$key" '
        [ .[][] | select(((.body // "") | startswith($key)) and .user.login == "github-actions[bot]" and (has("pull_request") | not)) ] |
        if length > 1 then error("Duplicate runtime incident") else (.[0].number // "") end')"
    if [[ -z "$issue" ]]; then
      issue="$(gh api "$endpoint" --method POST --raw-field title="$title" \
        --raw-field body="$key"$'\n'"Pages runtime observation failed. See $run_url for the authenticated release and incident evidence." \
        --jq .number)"
    fi
    [[ "$issue" =~ ^[1-9][0-9]*$ ]]
    printf 'issue=%s\n' "$issue" >> "$GITHUB_OUTPUT"
    echo "::error::ForgeKit Pages incident #$issue"
    ;;
  budget|claim|report)
    [[ "$ISSUE" =~ ^[1-9][0-9]*$ ]]
    comments="$endpoint/$ISSUE/comments"
    if [[ "$1" == report ]]; then
      gh api "$comments" --method POST --raw-field body="$REPORT. See $run_url for evidence." >/dev/null
      exit
    fi
    attempted="$(gh api --paginate --slurp "$comments?per_page=100" | jq -er --arg claim "$claim" '
      [ .[][] | select(.user.login == "github-actions[bot]" and (.body | startswith($claim))) ] | length')"
    if [[ "$1" == budget ]]; then
      [[ "$attempted" -le 1 ]]
      printf 'attempted=%s\n' "$attempted" >> "$GITHUB_OUTPUT"
    else
      [[ "$attempted" == 0 ]]
      gh api "$comments" --method POST --raw-field body="$(printf '%s\nClaimed before deployment. %s' "$claim" "$run_url")" >/dev/null
    fi
    ;;
  *) exit 2 ;;
esac
