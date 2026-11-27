#!/usr/bin/env bash
# Installs (or refreshes) the weekly off-site backup job on the server (#1332). Run by the deploy, as root,
# once the new release is live. Safe to run again and again: each step changes something only when it differs.
#
# Usage: bash ops/install-offsite-backup.sh [--config-stdin]
#   --config-stdin  the Drive credential (an rclone config section) arrives on stdin, from the GitHub
#                   Actions secret OFFSITE_BACKUP_RCLONE_CONF in the `production` environment, never in an
#                   argument or a log. Empty stdin means "no new credential": an earlier one is kept.
#
# The job needs three things, and until all three exist nothing is installed and nothing is uploaded: the owner's
# public key in the release (ops/offsite-backup-cert.pem), the credential, and rclone. With any piece missing the
# script says which one in a notice and succeeds, so a deploy never fails for a step the owner has not done yet. A
# public key or credential that is present but wrong fails the deploy, with the reason.
#   1. check the public key (offsite-lib.sh): one RSA certificate, no private key
#   2. check and store the credential: exactly one [offsite] section of type drive with the narrow drive.file
#      scope and nothing else, in a root-only file in a root-only folder, written under a temporary name and renamed
#   3. install rclone from the pinned package, after checking its SHA-256 (a version already there is kept)
#   4. install the weekly job in /etc/cron.d (rewritten only when it would change)
#   5. try the credential once with a small made-up file (offsite-backup.sh test), for each new credential or key
#   6. run the check (offsite-backup.sh check): the newest copy in Drive is recent and the last run went well
# Roll back: ops/README.md, "Off-site backup".
set -Eeuo pipefail

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/offsite-lib.sh"

ROOT_UID="${OFFSITE_ROOT_UID:-0}"
OFFSITE_CERT="${OFFSITE_CERT:-$CODE_DIR/ops/offsite-backup-cert.pem}"
BACKUP_SCRIPT="$APP_DIR/current/ops/offsite-backup.sh"
TRIED_MARK="$OFFSITE_DIR/offsite-tried" # the fingerprint of the credential and key last tried
RCLONE="${RCLONE:-rclone}"
umask 077

on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "ERROR: off-site backup install stopped unexpectedly at line $1 of install-offsite-backup.sh"
  exit 1
}
trap 'on_unexpected_error $LINENO' ERR

config_stdin=""
if [ "${1:-}" = --config-stdin ]; then
  IFS= read -r -d '' config_stdin || true
fi

[ "$(id -u)" = "$ROOT_UID" ] || {
  report "ERROR: off-site backup install must run as root; nothing was changed"
  exit 1
}

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
  report "ERROR: off-site backup: $problem; the weekly job was taken away"
  exit 1
fi

# --- 2. the credential
mkdir -p "$OFFSITE_DIR"
chmod 700 "$OFFSITE_DIR"
if [ -n "$config_stdin" ]; then
  # The section is checked line by line. Anything beyond these keys (a different scope, a pointer to another
  # file, a command to run) is refused, and the message never repeats a value.
  keys_seen=""
  sections=0
  scope_ok=no
  type_ok=no
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in
      "" | "#"*) continue ;;
      "[$OFFSITE_REMOTE_NAME]") sections=$((sections + 1)) ;;
      "["*)
        remove_job
        report "ERROR: off-site backup: the credential has a section other than [$OFFSITE_REMOTE_NAME]; it was not stored"
        exit 1
        ;;
      *=*)
        key=${line%%=*}
        key=${key%"${key##*[![:space:]]}"}
        value=${line#*=}
        value=${value#"${value%%[![:space:]]*}"}
        case "$key" in
          type) [ "$value" = drive ] && type_ok=yes ;;
          scope) [ "$value" = drive.file ] && scope_ok=yes ;;
          client_id | client_secret | token) [ -n "$value" ] && keys_seen="$keys_seen $key" ;;
          # rclone writes these three with nothing after the `=` for a personal Drive; a value would point the job
          # at a shared drive, a folder or a key file, so only the empty form is accepted.
          team_drive | root_folder_id | service_account_file)
            if [ -n "$value" ]; then
              report "ERROR: off-site backup: the credential sets $key, which is not allowed; it was not stored"
              exit 1
            fi
            ;;
          *)
            # Only a plain setting name is shown, never anything that could be a value.
            [[ "$key" =~ ^[a-z_]{1,40}$ ]] || key="with an unreadable name"
            report "ERROR: off-site backup: the credential has a setting ($key) that is not allowed; it was not stored"
            exit 1
            ;;
        esac
        ;;
      *)
        report "ERROR: off-site backup: the credential has a line that is not a setting; it was not stored"
        exit 1
        ;;
    esac
  done <<<"$config_stdin"
  [ "$sections" = 1 ] && [ "$type_ok" = yes ] || {
    report "ERROR: off-site backup: the credential must be one [$OFFSITE_REMOTE_NAME] section of type drive; it was not stored"
    exit 1
  }
  [ "$scope_ok" = yes ] || {
    report "ERROR: off-site backup: the credential's scope must be drive.file (the job may see only the files it makes); it was not stored"
    exit 1
  }
  for need in client_id client_secret token; do
    case " $keys_seen " in
      *" $need "*) ;;
      *)
        report "ERROR: off-site backup: the credential has no $need; it was not stored"
        exit 1
        ;;
    esac
  done
  tmp=$(mktemp "$OFFSITE_DIR/.offsite-rclone.XXXXXX")
  printf '%s\n' "$config_stdin" >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$OFFSITE_RCLONE_CONF"
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
    *)
      report "ERROR: off-site backup: no pinned rclone package for this server's architecture ($arch)"
      exit 1
      ;;
  esac
  package="rclone-v$OFFSITE_RCLONE_VERSION-linux-$arch.deb"
  download=$(mktemp -d)
  trap 'rm -rf "$download"' EXIT
  curl -fsSL --proto '=https' --tlsv1.2 --max-time 300 -o "$download/$package" "$OFFSITE_RCLONE_URL/v$OFFSITE_RCLONE_VERSION/$package" || {
    report "ERROR: off-site backup: downloading $package failed; nothing was installed"
    exit 1
  }
  got_sha=$(sha256sum "$download/$package" | cut -d' ' -f1)
  [ "$got_sha" = "$want_sha" ] || {
    report "ERROR: off-site backup: $package does not match its pinned SHA-256; nothing was installed"
    exit 1
  }
  dpkg -i "$download/$package" >/dev/null 2>&1 || {
    report "ERROR: off-site backup: installing $package failed"
    exit 1
  }
  [ "$(installed_version)" = "$OFFSITE_RCLONE_VERSION" ] || {
    report "ERROR: off-site backup: rclone $OFFSITE_RCLONE_VERSION is not what runs after the install"
    exit 1
  }
  report "off-site backup: rclone $OFFSITE_RCLONE_VERSION installed (SHA-256 checked)"
fi

# --- 4. the weekly job: Sunday 09:30 UTC, after the daily backup of 08:15 and the Umami dump
if [ ! -f "$BACKUP_SCRIPT" ]; then
  report "ERROR: $BACKUP_SCRIPT not found, so the off-site backup job was not installed"
  exit 1
fi
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
  report "off-site backup: weekly job installed (Sunday 09:30 UTC)"
fi

# --- 5. try this credential and key once, with a small made-up file, so a wrong credential shows on this deploy
# The fingerprint holds what makes the credential and the key what they are, not the access token rclone refreshes
# (and rewrites into the file) in every run, so a weekly run does not make the next deploy try again.
fingerprint=$(
  {
    grep -E '^(client_id|client_secret)[[:space:]]*=' "$OFFSITE_RCLONE_CONF" || true
    grep -o '"refresh_token"[[:space:]]*:[[:space:]]*"[^"]*"' "$OFFSITE_RCLONE_CONF" || true
    cat "$OFFSITE_CERT"
  } | sha256sum | cut -d' ' -f1
)
if [ "$(cat "$TRIED_MARK" 2>/dev/null || true)" != "$fingerprint" ]; then
  if bash "$BACKUP_SCRIPT" test; then
    printf '%s\n' "$fingerprint" >"$TRIED_MARK"
  else
    report "ERROR: off-site backup: the credential or the public key did not pass the test upload; it is tried again on the next deploy"
    exit 1
  fi
fi

# --- 6. the signal: every deploy reads the state of the copies in Drive. A copy older than the limit, or a
#        weekly run that failed, turns the deploy red (the check says which).
bash "$BACKUP_SCRIPT" check || exit 1
report "off-site backup job in place (weekly, newest $OFFSITE_KEEP copies kept)"
