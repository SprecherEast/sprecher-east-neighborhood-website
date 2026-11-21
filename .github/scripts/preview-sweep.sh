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
# between (its number is not in the inventory) is never taken for a stray. If either list fails, or any line of the
# inventory is not one this sweep knows, it stops BEFORE removing anything: an empty list from a failed call must
# never read as "no pull request is open". Just before each removal the number's line is read again and the rule
# is applied to it afresh, so a preview that was deployed (or removed) meanwhile is left alone. The job summary is
# written in every case, with the reason when the sweep stopped.
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
# shellcheck source=preview-list-lib.sh
. "${BASH_SOURCE[0]%/*}/preview-list-lib.sh"

removed=() failed=() skipped=() stopped=()
kept=0
rows=""
stopped_because=""

write_summary() {
  {
    echo "### Pull request previews swept"
    echo
    if [ -n "$stopped_because" ]; then
      echo "**The sweep stopped before removing anything: $stopped_because.**"
    else
      echo "Removed ${#removed[@]}, kept $kept, failed ${#failed[@]}, left alone ${#skipped[@]}."
    fi
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
}
trap write_summary EXIT

stop() { # <why>
  stopped_because=$1
  echo "::error title=Preview sweep::$1"
  exit 1
}

inventory=$(preview_list) || stop "the server did not list its previews"
list_is_valid "$inventory" || stop "the server's list has a line this sweep does not know"
open_prs=$(gh api --paginate "repos/$GITHUB_REPOSITORY/pulls?state=open&per_page=100" --jq '.[].number') ||
  stop "the open pull requests could not be listed"
declare -A is_open=()
for number in $open_prs; do
  valid_preview_number "$number" || stop "the open pull requests came back in a form this sweep does not know"
  is_open[$number]=yes
done

limit_seconds=$((PREVIEW_IDLE_DAYS * 86400))
# Why a preview should be removed, from its parsed line (LIST_*), or nothing.
reason_to_remove() {
  if [ -z "${is_open[$LIST_NUMBER]:-}" ]; then
    echo "its pull request is not open"
  elif [ "$LIST_FOLDER" = no ]; then
    echo "left over without its folder"
  elif [ "$LIST_IDLE" -gt "$limit_seconds" ]; then
    echo "not deployed for more than $PREVIEW_IDLE_DAYS days"
  fi
}

# Decide for every line first; only then remove.
candidates=()
while IFS= read -r line; do
  [ -n "$line" ] || continue
  parse_list_line "$line"
  valid_preview_number "$LIST_NUMBER" || continue
  if [ -n "$(reason_to_remove)" ]; then
    candidates+=("$LIST_NUMBER")
  else
    kept=$((kept + 1))
    [ "$LIST_PROCESS" = online ] || stopped+=("#$LIST_NUMBER")
  fi
done <<<"$inventory"

for number in "${candidates[@]}"; do
  # The number's line right now: it may have been deployed, or removed, since the inventory was read.
  fresh=$(preview_list) && list_is_valid "$fresh" || {
    failed+=("#$number")
    rows+="| #$number | **could not be checked again** | |"$'\n'
    continue
  }
  line=$(list_line_of "$number" "$fresh")
  if [ -z "$line" ]; then
    skipped+=("#$number")
    rows+="| #$number | already gone | |"$'\n'
    continue
  fi
  parse_list_line "$line"
  reason=$(reason_to_remove)
  if [ -z "$reason" ]; then
    skipped+=("#$number")
    rows+="| #$number | left alone | it changed since the sweep began |"$'\n'
    continue
  fi
  if ssh vps "teardown $number" >/dev/null 2>&1; then
    removed+=("#$number")
    rows+="| #$number | removed | $reason |"$'\n'
  else
    failed+=("#$number")
    rows+="| #$number | **could not be removed** | $reason |"$'\n'
  fi
done

echo "::notice title=Preview sweep::removed ${#removed[@]}, kept $kept, failed ${#failed[@]}, left alone ${#skipped[@]}"
[ "${#failed[@]}" -eq 0 ] || {
  echo "::error title=Preview sweep::some previews could not be removed"
  exit 1
}
