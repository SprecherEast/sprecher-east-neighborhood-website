#!/usr/bin/env bash
# Decides whether a commit of main gets deployed (#245). Writes `deploy` and `redeploy`
# (true|false) to $GITHUB_OUTPUT. The release is named after the commit, plus `-run<run id>` when
# `redeploy` is true; the jobs build that name from github.sha themselves. A job output holding
# the commit hash is dropped whenever it happens to contain a secret's value, which emptied the
# release name and failed the deploy (#382), so only true/false travels between jobs.
#
# Skipped: a commit older than the live one (deploys can finish out of order), the commit that is
# already live, and changes that touch only files that don't run on the server: the same list the
# deploy's old push filter ignored. A run started by hand deploys whatever it changed, including
# the live commit again (after a change to a NEXT_PUBLIC_* setting, say), as a new release folder.
#
# Environment: SHA, DEPLOYED (the live commit, may be empty), EVENT, RUN_ID, GITHUB_OUTPUT.
set -euo pipefail

: "${SHA:?}" "${GITHUB_OUTPUT:?}"
DEPLOYED="${DEPLOYED:-}"
EVENT="${EVENT:-push}"
redeploy=false

decide() { # <true|false> <reason>
  echo "deploy=$1" >>"$GITHUB_OUTPUT"
  echo "redeploy=$redeploy" >>"$GITHUB_OUTPUT"
  echo "::notice title=Deploy plan::$2"
  exit 0
}

if [ -z "$DEPLOYED" ] || ! git cat-file -e "$DEPLOYED^{commit}" 2>/dev/null; then
  decide true "the live commit is unknown, so ${SHA:0:7} is deployed"
fi
if [ "$DEPLOYED" = "$SHA" ]; then
  [ "$EVENT" = workflow_dispatch ] || decide false "${SHA:0:7} is already live"
  redeploy=true # a new folder, <commit>-run<run id>: the live one is never replaced
  decide true "started by hand: ${SHA:0:7} is deployed again"
fi
if git merge-base --is-ancestor "$SHA" "$DEPLOYED"; then
  decide false "${DEPLOYED:0:7}, newer than ${SHA:0:7}, is already live"
fi
[ "$EVENT" != workflow_dispatch ] || decide true "started by hand: ${SHA:0:7} is deployed"

while IFS= read -r file; do
  case "$file" in
    *.md | .claude/* | .agents/* | .github/* | .env.local.example | docs/* | LICENSE) ;;
    *) decide true "${file} changed since ${DEPLOYED:0:7}, so ${SHA:0:7} is deployed" ;;
  esac
done < <(git diff --name-only "$DEPLOYED" "$SHA")
decide false "only docs and repo tooling changed since ${DEPLOYED:0:7}, so nothing is deployed"
