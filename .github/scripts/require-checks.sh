#!/usr/bin/env bash
# Waits until the required checks have passed on a commit of main, and fails if one of them
# failed (#245). The deploy runs only on green: AGENTS.md lists the required checks.
#
# Only runs started by the push to main count. The daily scheduled Lint run, which audits
# dependencies again, can fail on the same commit when a new advisory appears; it shouldn't
# block a deploy of code that passed when it merged, and the next change will be audited anyway.
#
# The default set is the main ruleset's required checks, except the ones that cannot run on a push
# to main: `PR Policy` runs on pull requests only (pr-policy.yml), and `End-to-end tests` are not
# required by the ruleset yet (#868). Lint's `Prettier`, `ESLint`, `Dependency Audit` and
# `Agent context`, and CI's `Type-check & Build` and `Knowledge sync`, all run on the push. A
# required job that is missing or skipped never counts as passed.
#
# Environment: GH_TOKEN (actions: read), REPO (owner/name), SHA, and optionally REQUIRED (job
# names, comma-separated) and TIMEOUT_SECONDS.
set -euo pipefail

: "${GH_TOKEN:?}" "${REPO:?}" "${SHA:?}"
REQUIRED="${REQUIRED:-Type-check & Build,Prettier,ESLint,Dependency Audit,Knowledge sync,Agent context}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"

IFS=',' read -r -a required <<<"$REQUIRED"
deadline=$((SECONDS + TIMEOUT_SECONDS))

while :; do
  # name<TAB>status<TAB>conclusion for every job of every push run on this commit
  jobs=""
  for run in $(gh api "repos/$REPO/actions/runs?head_sha=$SHA&event=push&per_page=100" --jq '.workflow_runs[].id'); do
    jobs+=$(gh api "repos/$REPO/actions/runs/$run/jobs?filter=latest&per_page=100" \
      --jq '.jobs[] | [.name, .status, (.conclusion // "")] | @tsv')$'\n'
  done

  pending=()
  for name in "${required[@]}"; do
    line=$(awk -F'\t' -v n="$name" '$1 == n' <<<"$jobs" | tail -n 1)
    status=$(cut -f2 <<<"$line")
    conclusion=$(cut -f3 <<<"$line")
    # Lint cancels its run on main when a newer commit arrives; that commit deploys instead. A
    # cancel while this commit is still main's head (the daily scheduled Lint shares the
    # concurrency group, or someone cancelled it) means nothing replaced it: fail, so the checks
    # get re-run and the deploy started again.
    if [ "$status" = completed ] && [ "$conclusion" = cancelled ]; then
      head=$(gh api "repos/$REPO/commits/main" --jq '.sha')
      if [ "$head" != "$SHA" ]; then
        echo "::notice title=Checks::$name was cancelled on $SHA and main has moved on to ${head:0:7}, which deploys instead"
        echo "cancelled=true" >>"${GITHUB_OUTPUT:-/dev/null}"
        exit 0
      fi
      echo "::error title=Checks::$name was cancelled on $SHA, which is still main's head; re-run the checks, then the deploy (Actions → Deploy to VPS → Run workflow)"
      exit 1
    fi
    if [ "$status" = completed ] && [ "$conclusion" != success ]; then
      echo "::error title=Checks::$name finished with '$conclusion' on $SHA, so it is not deployed"
      exit 1
    fi
    [ "$status" = completed ] || pending+=("$name")
  done

  if [ "${#pending[@]}" -eq 0 ]; then
    echo "::notice title=Checks::all required checks passed on $SHA"
    exit 0
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error title=Checks::still waiting after ${TIMEOUT_SECONDS}s for: $(IFS=','; echo "${pending[*]}")"
    exit 1
  fi
  sleep 20
done
