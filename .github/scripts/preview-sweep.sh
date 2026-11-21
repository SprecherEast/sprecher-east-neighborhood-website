#!/usr/bin/env bash
# The nightly sweep of pull request previews (#1076): removes, through the restricted preview account's
# wrapper (ops/preview-wrapper.sh), what should not be on the server, and says what it removed in the job
# summary. Run by the scheduled workflow in the `preview` environment, from main's copy of the scripts, after
# `ssh vps` was set up by .github/actions/vps-ssh. It removes a preview when
#   - its pull request is not open (closed, or no such number), or
#   - it is left over without its folder (a Caddy block or a PM2 process only), even when its pull request is open, or
#   - nobody deployed it for PREVIEW_IDLE_DAYS (ops/environment.sh); the next push or a re-run brings it back.
# A preview whose process is stopped is only listed as stopped (nothing starts previews again after a reboot, see
# ops/previews.md); it is removed by the rules above in time.
#
# Order matters: the server's inventory is read FIRST and the open pull requests AFTER, so a preview created in
# between (its number is not in the inventory) is never taken for a stray. If either list fails the sweep stops
# and removes nothing: an empty list from a failed call must never read as "no pull request is open".
# Removing goes through `teardown <number>` only, whose number is checked as digits here and again by the
# wrapper, which makes nothing of a number but a path component. The summary names numbers, reasons and counts.
#
# Environment: GH_TOKEN (read access to pull requests), GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY, optionally
# OPS_DIR (main's ops folder). A removal that fails fails the step after every other one was tried.
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${GITHUB_STEP_SUMMARY:?}"
OPS_DIR="${OPS_DIR:-ops}"
# shellcheck source=../../ops/environment.sh
. "$OPS_DIR/environment.sh"
# shellcheck source=../../ops/preview-access-lib.sh
. "$OPS_DIR/preview-access-lib.sh"

inventory=$(ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps list) || {
  echo "::error title=Preview sweep::the server did not list its previews"
  exit 1
}
open_prs=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls?state=open&per_page=100" --jq '.[].number') || {
  echo "::error title=Preview sweep::the open pull requests could not be listed"
  exit 1
}
declare -A is_open=()
for number in $open_prs; do
  valid_preview_number "$number" || {
    echo "::error title=Preview sweep::the open pull requests came back in a form this sweep does not know"
    exit 1
  }
  is_open[$number]=yes
done

limit_seconds=$((PREVIEW_IDLE_DAYS * 86400))
pattern='^preview=([0-9]+) commit=([0-9a-f]+|none) idle=([0-9]+) folder=(yes|no) block=(yes|no) process=(online|stopped|none)$'
removed=() failed=() kept=0 stopped=()
rows=""
while IFS= read -r line; do
  [ -n "$line" ] || continue
  [[ "$line" =~ $pattern ]] || {
    echo "::error title=Preview sweep::the server's list has a line this sweep does not know"
    exit 1
  }
  number=${BASH_REMATCH[1]} idle=${BASH_REMATCH[3]} folder=${BASH_REMATCH[4]} state=${BASH_REMATCH[6]}
  valid_preview_number "$number" || continue
  reason=""
  if [ -z "${is_open[$number]:-}" ]; then
    reason="its pull request is not open"
  elif [ "$folder" = no ]; then
    reason="left over without its folder"
  elif [ "$idle" -gt "$limit_seconds" ]; then
    reason="not deployed for more than $PREVIEW_IDLE_DAYS days"
  fi
  if [ -z "$reason" ]; then
    kept=$((kept + 1))
    [ "$state" = online ] || stopped+=("#$number")
    continue
  fi
  if ssh vps "teardown $number" >/dev/null 2>&1; then
    removed+=("#$number")
    rows+="| #$number | removed | $reason |"$'\n'
  else
    failed+=("#$number")
    rows+="| #$number | **could not be removed** | $reason |"$'\n'
  fi
done <<<"$inventory"

{
  echo "### Pull request previews swept"
  echo
  echo "Removed ${#removed[@]}, kept $kept, failed ${#failed[@]}."
  if [ -n "$rows" ]; then
    echo
    echo "| Pull request | Result | Why |"
    echo "| --- | --- | --- |"
    printf '%s' "$rows"
  fi
  if [ "${#stopped[@]}" -gt 0 ]; then
    echo
    echo "Stopped, not removed (a push or a re-run of the deploy starts one again): ${stopped[*]}"
  fi
} >>"$GITHUB_STEP_SUMMARY"

echo "::notice title=Preview sweep::removed ${#removed[@]}, kept $kept, failed ${#failed[@]}"
[ "${#failed[@]}" -eq 0 ] || {
  echo "::error title=Preview sweep::some previews could not be removed"
  exit 1
}
