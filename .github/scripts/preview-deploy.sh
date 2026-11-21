#!/usr/bin/env bash
# Puts a built pull request preview live (#1075), through the restricted preview account's wrapper
# (ops/preview-wrapper.sh) and never through ops/deploy-release.sh directly. Run by a job in the `preview`
# environment, from main's copy of the scripts, after `ssh vps` was set up by .github/actions/vps-ssh. It
# never runs, unpacks or reads the archive: the archive only goes to the server's stdin, where the wrapper
# checks it again.
#
# Writes `result` to $GITHUB_OUTPUT, one of:
#   live         the wrapper's deploy succeeded (it checked the home page and /api/version through Caddy);
#                `url` is then written too: https://pr-<number>.<preview domain>
#   limit        another preview is up and only PREVIEWS_AT_ONCE are allowed for now: not an error
#   too-big      the archive is over the upload limit, or what it unpacks to is over PREVIEW_UNPACK_MAX_BYTES
#   unreadable   the archive's listing can't be measured
#   taken-down   the isolation check failed, so the wrapper took the preview down (a failed check before
#                the deploy takes down a preview already running under that number)
#   failed       any other failure; the wrapper has put the previous release back where there was one
# Every result but `live` and `limit` also fails the step. Nothing is retried. The log shows only what the
# wrapper and the deploy script print, which is built never to hold a secret.
#
# Environment: NUMBER (the pull request's number), SHA (the commit built), ARCHIVE (the release .tar.gz),
# GITHUB_OUTPUT, and optionally PREVIEWS_AT_ONCE (default 1: the temporary limit until the cap work lands
# on #1070) and OPS_DIR (main's ops folder, default ops).
set -euo pipefail

: "${NUMBER:?}" "${SHA:?}" "${ARCHIVE:?}" "${GITHUB_OUTPUT:?}"
PREVIEWS_AT_ONCE="${PREVIEWS_AT_ONCE:-1}"
OPS_DIR="${OPS_DIR:-ops}"
# The patterns and limits the server checks too: defined once, in main's ops folder.
# shellcheck source=../../ops/environment.sh
. "$OPS_DIR/environment.sh"
# shellcheck source=../../ops/preview-access-lib.sh
. "$OPS_DIR/preview-access-lib.sh"

finish() { # <result> <exit code> <message>
  echo "result=$1" >>"$GITHUB_OUTPUT"
  case "$2" in
    0) echo "::notice title=Pull request preview::$3" ;;
    *) echo "::error title=Pull request preview::$3" ;;
  esac
  exit "$2"
}

valid_preview_number "$NUMBER" && valid_commit "$SHA" || {
  echo "::error title=Pull request preview::not a pull request number and commit"
  exit 1
}
[ -f "$ARCHIVE" ] || {
  echo "::error title=Pull request preview::there is no release archive"
  exit 1
}

# Before anything is sent: the wrapper checks both limits again, but refusing here saves the upload.
size=$(stat -c %s "$ARCHIVE")
[ "$size" -le "$PREVIEW_UPLOAD_MAX_BYTES" ] ||
  finish too-big 1 "the release archive is over the upload limit of $PREVIEW_UPLOAD_MAX_BYTES bytes"
measured=0
unpacked_bytes "$ARCHIVE" "$PREVIEW_UNPACK_MAX_BYTES" >/dev/null || measured=$?
[ "$measured" != 2 ] ||
  finish too-big 1 "the release unpacks to more than $PREVIEW_UNPACK_MAX_BYTES bytes"
[ "$measured" = 0 ] || finish unreadable 1 "the release archive's listing can't be measured"

# The temporary limit: a second preview is not started while another one is up.
listing=$(ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps list) ||
  finish failed 1 "the server did not list its previews"
others=0
already_live=no
while read -r line; do
  [[ "$line" =~ ^preview=([0-9]+)\ commit= ]] || continue
  [ "${BASH_REMATCH[1]}" = "$NUMBER" ] || others=$((others + 1))
  [ "$line" != "preview=$NUMBER commit=$SHA" ] || already_live=yes
done <<<"$listing"

# The address, from the same file the server reads (a pull request's number alone decides it).
preview_url() { (PREVIEW_NUMBER="$NUMBER" && . "$OPS_DIR/environment.sh" && echo "$SITE_URL"); }

# A re-run, a reopened pull request or the label added again at the commit that is live: the wrapper refuses
# to upload the live release, and nothing needs deploying, so it is live as it is.
if [ "$already_live" = yes ]; then
  echo "url=$(preview_url)" >>"$GITHUB_OUTPUT"
  finish live 0 "preview $NUMBER is already live at commit ${SHA:0:7}; nothing was sent"
fi
if [ "$others" -ge "$PREVIEWS_AT_ONCE" ]; then
  finish limit 0 "another preview is up and only $PREVIEWS_AT_ONCE is allowed at once for now; this one was not started"
fi

# The archive goes to the wrapper on stdin and nowhere else.
ssh vps "upload $NUMBER $SHA" <"$ARCHIVE" || finish failed 1 "the release could not be uploaded"

log=$(mktemp)
trap 'rm -f "$log"' EXIT
status=0
ssh vps "deploy $NUMBER $SHA" >"$log" 2>&1 || status=$?
cat "$log"
if [ "$status" -eq 0 ]; then
  echo "url=$(preview_url)" >>"$GITHUB_OUTPUT"
  finish live 0 "preview $NUMBER is live at commit ${SHA:0:7}"
fi
# The wrapper's own fixed text, not the log: it says a failed check took the preview down.
if grep -qF 'the isolation check failed, so the preview was taken down' "$log"; then
  finish taken-down 1 "the isolation check failed, so the preview was taken down"
fi
finish failed 1 "the preview did not go live; a previous release of it, if there was one, was put back"
