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
#   limit        as many previews are up as the cap allows (PREVIEW_MAX_COUNT, ops/environment.sh): not an error.
#                `cap` and `holders` (the pull requests holding the places, comma separated) are written too
#   disk-low     the server would be left with less free disk than production's floor: not an error
#   too-big      the archive is over the upload limit, or what it unpacks to is over PREVIEW_UNPACK_MAX_BYTES
#   unreadable   the archive's listing can't be measured
#   taken-down   the isolation check failed, so the wrapper took the preview down (a failed check before
#                the deploy takes down a preview already running under that number)
#   failed       any other failure; the wrapper has put the previous release back where there was one
# Every result but `live`, `limit` and `disk-low` also fails the step. Nothing is retried. The log shows only what the
# wrapper and the deploy script print, which is built never to hold a secret.
#
# Environment: NUMBER (the pull request's number), SHA (the commit built), ARCHIVE (the release .tar.gz),
# GITHUB_OUTPUT, and optionally OPS_DIR (main's ops folder, default ops). The cap is ops/environment.sh's
# PREVIEW_MAX_COUNT, the one definition the server enforces too (#1076).
set -euo pipefail

: "${NUMBER:?}" "${SHA:?}" "${ARCHIVE:?}" "${GITHUB_OUTPUT:?}"
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

# The cap: a new preview is not started while as many as the cap allows are up (the server refuses too).
listing=$(ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps list) ||
  finish failed 1 "the server did not list its previews"
others=0
holders=""
already_live=no
read_listing() { # the other previews (a count and their numbers) and whether this commit is live, from $listing
  others=0
  holders=""
  already_live=no
  while read -r line; do
    [[ "$line" =~ ^preview=([0-9]+)\ commit= ]] || continue
    if [ "${BASH_REMATCH[1]}" != "$NUMBER" ]; then
      others=$((others + 1))
      holders="${holders:+$holders,}${BASH_REMATCH[1]}"
    fi
    [[ "$line" != "preview=$NUMBER commit=$SHA" && "$line" != "preview=$NUMBER commit=$SHA "* ]] || already_live=yes
  done <<<"$listing"
}
read_listing

# The cap is reached: not an error. The comment names the cap and the pull requests that hold the places.
at_the_cap() {
  {
    echo "cap=$PREVIEW_MAX_COUNT"
    echo "holders=$holders"
  } >>"$GITHUB_OUTPUT"
  finish limit 0 "as many previews as are allowed ($PREVIEW_MAX_COUNT) are up; this one was not started"
}

# The address, from the same file the server reads (a pull request's number alone decides it).
preview_url() { (PREVIEW_NUMBER="$NUMBER" && . "$OPS_DIR/environment.sh" && echo "$SITE_URL"); }

# A re-run, a reopened pull request or the label added again at the commit that is live: the wrapper refuses
# to upload the live release, and nothing needs deploying, so it is live as it is.
if [ "$already_live" = yes ]; then
  echo "url=$(preview_url)" >>"$GITHUB_OUTPUT"
  finish live 0 "preview $NUMBER is already live at commit ${SHA:0:7}; nothing was sent"
fi
# A preview that already has a place is only redeployed; a new one needs a free place (a `list` line for this
# number counts as having one, and `others` leaves it out).
if [ "$others" -ge "$PREVIEW_MAX_COUNT" ] && ! grep -q "^preview=$NUMBER " <<<"$listing"; then
  at_the_cap
fi

# The archive goes to the wrapper on stdin and nowhere else. Its refusals are fixed texts, so the log can be read.
upload_log=$(mktemp)
log=$(mktemp)
trap 'rm -f "$log" "$upload_log"' EXIT
if ! ssh vps "upload $NUMBER $SHA" <"$ARCHIVE" >"$upload_log" 2>&1; then
  cat "$upload_log"
  if grep -qF 'not enough free disk' "$upload_log"; then
    finish disk-low 0 "the server does not have the free disk to put this preview up and keep production's floor"
  fi
  # Two previews started together and the other took the last place after this one's `list`.
  if grep -qF 'as many previews as are allowed' "$upload_log"; then
    listing=$(ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps list) && read_listing || true
    at_the_cap
  fi
  finish failed 1 "the release could not be uploaded"
fi
cat "$upload_log"

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
