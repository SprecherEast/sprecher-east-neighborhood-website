#!/usr/bin/env bash
# Installs (or refreshes) the weekly off-site backup job on the server (#1332, ops/offsite-backup.md). Run by the
# deploy, as root, once the new release is live. Safe to run again and again: each step changes something only when
# it differs. It never fails the deploy: a problem is a WARNING annotation on the run, with the reason, and the exit
# status is 0 (a failed or stale backup must not stall merges; the owner's question about a stronger signal is on #1332).
#
# Usage: bash ops/install-offsite-backup.sh [--config-stdin]
#   --config-stdin  the Drive credential (an rclone config section) arrives on stdin, from the GitHub
#                   Actions secret OFFSITE_BACKUP_RCLONE_CONF in the `production` environment, never in an
#                   argument or a log. An empty secret removes the stored credential and the weekly job: that is
#                   how the owner undoes it without a shell.
#
# The job needs three things, and until all three exist nothing is installed and nothing is uploaded: the owner's
# public key in the release (ops/offsite-backup-cert.pem), the credential, and rclone. With any piece missing the
# script says which one in a notice. Nothing is created on the server before the key and a credential both exist.
#   1. check the public key (offsite-lib.sh): one RSA certificate, no private key
#   2. check the credential and store it, written from the checked values (offsite-lib.sh), in a root-only file in a
#      root-only folder, under a temporary name that is renamed (and removed if the run is killed)
#   3. install rclone from the pinned package, after checking its SHA-256 (a version already there is kept)
#   4. install the weekly job in /etc/cron.d (rewritten only when it would change)
#   5. try the credential once with a small made-up file (offsite-backup.sh test), for each new credential or key
#   6. run the check (offsite-backup.sh check): the newest copy in Drive is recent and the last run went well
# Roll back: ops/offsite-backup.md, "Changes to the server and how to undo them".
set -Eeuo pipefail

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/offsite-lib.sh"

ROOT_UID="${OFFSITE_ROOT_UID:-0}" # a test runs as someone else. A deploy account that is not root would need sudo here (#1306)
BACKUP_SCRIPT="$APP_DIR/current/ops/offsite-backup.sh"
umask 077

tmp=""
download=""
cleanup() {
  [ -z "$tmp" ] || rm -f "$tmp"
  [ -z "$download" ] || rm -rf "$download"
}
trap cleanup EXIT
trap 'exit 143' TERM HUP INT # a killed run leaves no copy of the credential behind: the EXIT trap removes it

# A problem: a warning with the reason, and the deploy goes on.
give_up() { # <message>
  report "WARNING: off-site backup: $*"
  exit 0
}
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  give_up "the install stopped unexpectedly at line $1 of install-offsite-backup.sh; it is tried again on the next deploy"
}
trap 'on_unexpected_error $LINENO' ERR

config_stdin=""
have_stdin=no
if [ "${1:-}" = --config-stdin ]; then
  have_stdin=yes
  IFS= read -r -d '' config_stdin || true
fi

[ "$(id -u)" = "$ROOT_UID" ] || give_up "this must run as root; nothing was changed"

# Takes the weekly job away: with the key or the credential gone, nothing may keep running.
remove_job() { rm -f "$OFFSITE_CRON_FILE"; }

# --- 1. the public key
if [ ! -f "$OFFSITE_CERT" ]; then
  remove_job
  report "off-site backup is not set up: ops/offsite-backup-cert.pem (the owner's public key) is not in the repository yet"
  exit 0
fi
if problem=$(offsite_cert_problem "$OFFSITE_CERT"); then :; else
  remove_job
  give_up "$problem; the weekly job was taken away"
fi

# --- 2. the credential. An empty secret means "none": the stored one and the job go.
if [ "$have_stdin" = yes ] && [ -z "${config_stdin//[[:space:]]/}" ]; then
  if [ -f "$OFFSITE_RCLONE_CONF" ]; then
    rm -f "$OFFSITE_RCLONE_CONF" "$OFFSITE_TRIED_MARK"
    remove_job
    report "off-site backup: the secret is empty, so the stored Drive credential and the weekly job were removed (the copies in Drive stay)"
  fi
elif [ -n "$config_stdin" ]; then
  if offsite_conf_normalize "$config_stdin"; then :; else
    give_up "$OFFSITE_CONF_PROBLEM; it was not stored"
  fi
  mkdir -p "$OFFSITE_DIR"
  chmod 700 "$OFFSITE_DIR"
  tmp=$(mktemp "$OFFSITE_DIR/.offsite-rclone.XXXXXX")
  printf '%s' "$OFFSITE_CONF_CANONICAL" >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$OFFSITE_RCLONE_CONF"
  tmp=""
fi
if [ ! -f "$OFFSITE_RCLONE_CONF" ]; then
  remove_job
  report "off-site backup is not set up: the Drive credential (the OFFSITE_BACKUP_RCLONE_CONF secret) has not been set yet"
  exit 0
fi

# --- 3. rclone, pinned and checked
installed_version() { "$RCLONE" version 2>/dev/null | sed -n '1s/^rclone v//p'; }
if [ "$(installed_version)" != "$OFFSITE_RCLONE_VERSION" ]; then
  arch=$(dpkg --print-architecture 2>/dev/null || echo unknown)
  case "$arch" in
    amd64) want_sha="$OFFSITE_RCLONE_SHA256_AMD64" ;;
    arm64) want_sha="$OFFSITE_RCLONE_SHA256_ARM64" ;;
    *) give_up "no pinned rclone package for this server's architecture ($arch)" ;;
  esac
  package="rclone-v$OFFSITE_RCLONE_VERSION-linux-$arch.deb"
  download=$(mktemp -d)
  curl -fsSL --proto '=https' --tlsv1.2 --max-time 300 -o "$download/$package" "$OFFSITE_RCLONE_URL/v$OFFSITE_RCLONE_VERSION/$package" ||
    give_up "downloading $package failed; nothing was installed"
  got_sha=$(sha256sum "$download/$package" | cut -d' ' -f1)
  [ "$got_sha" = "$want_sha" ] || give_up "$package does not match its pinned SHA-256; nothing was installed"
  dpkg -i "$download/$package" >/dev/null 2>&1 || give_up "installing $package failed"
  [ "$(installed_version)" = "$OFFSITE_RCLONE_VERSION" ] || give_up "rclone $OFFSITE_RCLONE_VERSION is not what runs after the install"
  report "off-site backup: rclone $OFFSITE_RCLONE_VERSION installed (SHA-256 checked)"
fi

# --- 4. the weekly job: Sunday 09:30 UTC, after the daily backup of 08:15 and the Umami dump
[ -f "$BACKUP_SCRIPT" ] || give_up "$BACKUP_SCRIPT not found, so the job was not installed"
cron_text=$(
  cat <<EOF
# Weekly off-site backup of the Sprecher East site (#1332): the newest daily archive, sealed to the owner's public key, to Google Drive.
# Managed by ops/install-offsite-backup.sh in the website repo; changes here are overwritten on deploy.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 9 * * 0 root bash $BACKUP_SCRIPT run >> $OFFSITE_LOG 2>&1
EOF
)
if [ ! -f "$OFFSITE_CRON_FILE" ] || [ "$(cat "$OFFSITE_CRON_FILE")" != "$cron_text" ]; then
  tmp=$(mktemp)
  printf '%s\n' "$cron_text" >"$tmp"
  install -m 644 "$tmp" "$OFFSITE_CRON_FILE"
  rm -f "$tmp"
  tmp=""
  report "off-site backup: weekly job installed (Sunday 09:30 UTC)"
fi

# --- 5. try this credential and key once, with a small made-up file, so a wrong credential shows on this deploy.
# The fingerprint holds what makes the credential and the key what they are, not the access token rclone refreshes
# (and rewrites into the file) in every run, so a weekly run does not make the next deploy try again.
fingerprint=$(
  {
    grep -E '^(client_id|client_secret)[[:space:]]*=' "$OFFSITE_RCLONE_CONF" || true
    grep -o '"refresh_token"[[:space:]]*:[[:space:]]*"[^"]*"' "$OFFSITE_RCLONE_CONF" || true
    cat "$OFFSITE_CERT"
  } | sha256sum | cut -d' ' -f1
)
if [ "$(cat "$OFFSITE_TRIED_MARK" 2>/dev/null || true)" != "$fingerprint" ]; then
  if bash "$BACKUP_SCRIPT" test; then
    printf '%s\n' "$fingerprint" >"$OFFSITE_TRIED_MARK"
  else
    give_up "the credential or the public key did not pass the test upload; it is tried again on the next deploy"
  fi
fi

# --- 6. the signal: every deploy shows the state of the copies in Drive. A copy older than the limit, or a weekly run
# that failed, is a warning with the reason (the check prints it); the deploy stays green.
bash "$BACKUP_SCRIPT" check || true
report "off-site backup job in place (weekly, newest $OFFSITE_KEEP copies kept)"
