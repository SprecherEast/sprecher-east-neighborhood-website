#!/usr/bin/env bash
# Decides whether a pull request gets a pull request preview (#1075, epic #1070). Writes `build`
# (true|false) to $GITHUB_OUTPUT and says why in the job summary. It runs in a job with no secrets and
# no environment; a `false` ends the workflow green.
#
# A preview is made only when:
#   - the head is a branch of this repository: a fork's run gets no secrets and a read-only token, so
#     it can neither deploy nor comment (GitHub's rule for `pull_request` runs from forks);
#   - the author is not Dependabot, whose runs are read-only for the same reason;
#   - the change reaches the server: a pull request that changes only docs and repository tooling (the
#     list in deploy-paths.sh, the one the production deploy reads) is compared against its own base;
#   - it carries the `preview` label, which the AI agent that made a visual change adds once the owner
#     said yes, or anyone adds to ask for one (decision of 2026-11-20 on #1070 and #1075). Each preview
#     orders a certificate from a weekly budget production shares (ops/previews.md).
#
# Environment: HEAD_REPO and BASE_REPO (owner/name; an empty HEAD_REPO is a deleted fork), PR_AUTHOR (the login), HAS_LABEL (true|false: the
# pull request carries `preview`), BASE_SHA and HEAD_SHA (both commits are in the checkout),
# GITHUB_OUTPUT, and optionally GITHUB_STEP_SUMMARY.
set -euo pipefail

: "${BASE_REPO:?}" "${PR_AUTHOR:?}" "${BASE_SHA:?}" "${HEAD_SHA:?}" "${GITHUB_OUTPUT:?}"
HEAD_REPO="${HEAD_REPO:-}" # empty when the fork was deleted: it counts as a fork
HAS_LABEL="${HAS_LABEL:-false}"
# shellcheck source=deploy-paths.sh
. "$(dirname "$0")/deploy-paths.sh"

decide() { # <true|false> <reason, plain text>
  echo "build=$1" >>"$GITHUB_OUTPUT"
  echo "::notice title=Pull request preview::$2"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '### Pull request preview\n\n%s\n' "$2" >>"$GITHUB_STEP_SUMMARY"
  fi
  exit 0
}

# GitHub compares repository names without regard to case.
if [ "${HEAD_REPO,,}" != "${BASE_REPO,,}" ]; then
  decide false "No preview: this pull request comes from a fork. GitHub gives a fork's run no secrets and a read-only token, so it can't deploy or post a link."
fi
if [ "${PR_AUTHOR,,}" = "dependabot[bot]" ]; then
  decide false "No preview: this is a Dependabot pull request. GitHub gives Dependabot's run no secrets and a read-only token, so it can't deploy or post a link."
fi

# What this pull request changes, against the commit it branched from (three dots: its own changes only).
changed=$(git diff --name-only "$BASE_SHA...$HEAD_SHA")
reaches_server=no
while IFS= read -r file; do
  [ -n "$file" ] || continue
  if deploys_for_file "$file"; then
    reaches_server=yes
    break
  fi
done <<<"$changed"
if [ "$reaches_server" = no ]; then
  decide false "No preview: this pull request changes only docs and repository tooling, which never reach the server."
fi

if [ "$HAS_LABEL" != true ]; then
  decide false "No preview: previews are made only for a pull request with the \`preview\` label (each one orders a certificate from a weekly budget production shares). Add the label, or ask the owner, to get one."
fi
decide true "A preview will be built: the pull request changes code and carries the \`preview\` label."
