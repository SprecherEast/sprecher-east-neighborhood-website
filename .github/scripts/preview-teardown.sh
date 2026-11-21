#!/usr/bin/env bash
# Removes a pull request's preview when the pull request closes, merged or not (#1076), through the restricted
# preview account's wrapper (ops/preview-wrapper.sh): its `teardown` stops the PM2 process, deletes the folder
# (releases, database, media and settings) and the Caddy block, each step succeeding when the item is already
# gone, so running it twice is fine. Caddy's certificate storage is never touched, so a reopened pull request
# reuses its certificate. Run by a job in the `preview` environment, from main's copy of the scripts, after
# `ssh vps` was set up by .github/actions/vps-ssh.
#
# A closed pull request that never had a preview (most of them) asks nothing but `list`: no Caddy lock, no reload.
# Writes `removed` to $GITHUB_OUTPUT: `yes` when a preview, or a leftover of one, was there and is gone (checked
# with a second `list`), `no` when there was nothing. A failure fails the step; the nightly sweep tries again.
# The log shows only what the wrapper prints, which is built never to hold a secret.
#
# Environment: NUMBER (the pull request's number), GITHUB_OUTPUT, and optionally OPS_DIR (main's ops folder).
set -euo pipefail

: "${NUMBER:?}" "${GITHUB_OUTPUT:?}"
OPS_DIR="${OPS_DIR:-ops}"
# shellcheck source=../../ops/environment.sh
. "$OPS_DIR/environment.sh"
# shellcheck source=../../ops/preview-access-lib.sh
. "$OPS_DIR/preview-access-lib.sh"

valid_preview_number "$NUMBER" || {
  echo "::error title=Pull request preview::not a pull request number"
  exit 1
}

holds_number() { grep -q "^preview=$NUMBER " <<<"$1"; }
list_previews() { ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps list; }

listing=$(list_previews) || {
  echo "::error title=Pull request preview::the server did not list its previews"
  exit 1
}
if ! holds_number "$listing"; then
  echo "removed=no" >>"$GITHUB_OUTPUT"
  echo "::notice title=Pull request preview::preview $NUMBER does not exist; nothing to remove"
  exit 0
fi

ssh vps "teardown $NUMBER" || {
  echo "::error title=Pull request preview::the preview could not be removed"
  exit 1
}
listing=$(list_previews) || {
  echo "::error title=Pull request preview::the server did not list its previews after the removal"
  exit 1
}
if holds_number "$listing"; then
  echo "::error title=Pull request preview::something of the preview is still on the server"
  exit 1
fi
echo "removed=yes" >>"$GITHUB_OUTPUT"
echo "::notice title=Pull request preview::preview $NUMBER was removed"
