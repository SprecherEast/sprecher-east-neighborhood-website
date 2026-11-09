#!/usr/bin/env bash
# Installs and updates Umami analytics (#948), run by every deploy once the release is live and
# the Caddy settings are in place (ops/deploy-release.sh). Umami and its Postgres database run
# as two containers from ops/umami/compose.yaml, in /var/www/umami; Umami listens on 127.0.0.1
# only. Caddy is the only public way in (ops/caddy/umami.caddy), and the address is closed
# (answers 503) whenever Umami might have its default admin password, so it is never public with it.
#
# Environment: UMAMI_ADMIN_PASSWORD, the GitHub secret of that name, sent over the SSH session by
# the workflow (never an argument or a file). While the secret or the DNS name is missing the
# script changes nothing, says why in a `::notice`, and exits 0: the deploy still succeeds.
# PRE_DEPLOY_BACKUP_DONE=yes (set by deploy-release.sh) means this deploy already made a backup.
#
# Steps, each reported as an annotation (never a secret value):
#   0. close the public address (the route file Caddy serves becomes a 503 block, and Caddy is
#      reloaded) whenever the Umami container isn't running; a running database alone doesn't count
#   1. skip (exit 0) when the secret or the stats DNS name is missing, the password is weak, or
#      Docker is missing; refuse (exit 0, warning) when free memory is short and Umami isn't running
#   2. back up: the site on a first install (unless this deploy did), Umami's database on updates
#   3. write /var/www/umami/.env and compose.yaml, start the containers, wait for Umami on 127.0.0.1
#   4. replace the default admin password with the secret, then check the default is rejected
#   5. only then put the proxy in place, check it answers over HTTPS and rejects the default
# A failure from step 3 on exits 1 with the public address closed.
#
# Test seams (default to the server's real values): DISK_PATH, MIN_DISK_KB, UMAMI_DIR, UMAMI_PORT, UMAMI_HOST, CADDYFILE,
# UMAMI_CADDY_FILE, HSTS_FILE, RELOAD_CADDY, MEMINFO, MIN_FREE_KB, UP_WAIT, PUBLIC_WAIT,
# PUBLIC_BASE and PUBLIC_CURL_ARGS (how the public address is reached from the server itself).
set -Eeuo pipefail
umask 077
trap '' HUP

here=$(dirname "$0")
. "$here/lib.sh"
. "$here/umami-lib.sh"
. "$here/umami-caddy.sh"
. "$here/umami-admin.sh"

started=no   # yes once the containers are being started
secured=no   # yes once the default admin password is known to be rejected
closed_here=no # yes once this run closed the public address before anything else
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  local state="its public address is as the last successful run left it"
  [ "$closed_here" != yes ] || state="its public address was closed at the start of this run"
  if [ "$started" = yes ] && [ "$secured" = no ]; then
    if close_route; then state="its public address is closed"; else state="its public address could not be closed: see ops/umami/README.md"; fi
  fi
  report "ERROR: install-umami.sh failed unexpectedly at line $1; $state"
  exit 1
}
trap 'on_unexpected_error $LINENO' ERR

MEMINFO="${MEMINFO:-/proc/meminfo}"
MIN_FREE_KB="${MIN_FREE_KB:-1048576}" # about 1 GB for Umami and its database; the server has 4 GB
UP_WAIT="${UP_WAIT:-120}"             # seconds Umami may take to answer after it starts
PUBLIC_WAIT="${PUBLIC_WAIT:-60}"      # seconds Caddy may take to get the certificate
MIN_DISK_KB="${MIN_DISK_KB:-2097152}" # about 2 GB for the two images and the first data
DISK_PATH="${DISK_PATH:-/var/lib/docker}"
[ -d "$DISK_PATH" ] || DISK_PATH=$(dirname "$UMAMI_DIR")
MIN_PASSWORD_LENGTH=12
password="${UMAMI_ADMIN_PASSWORD:-}"
unset UMAMI_ADMIN_PASSWORD # not for the commands below to inherit

url=$(site_url)
host="${url#*://}"
host="${host%%:*}"
UMAMI_HOST="${UMAMI_HOST:-stats.${host#www.}}"
PUBLIC_BASE="${PUBLIC_BASE:-https://$UMAMI_HOST}"
base="http://127.0.0.1:$UMAMI_PORT"
# Reached through Caddy on this machine, the way the site's own checks are (ops/lib.sh).
PUBLIC_CURL_ARGS="${PUBLIC_CURL_ARGS---resolve $UMAMI_HOST:443:127.0.0.1}"

first_install=yes
verb=installed
if [ -f "$UMAMI_DIR/.env" ]; then
  first_install=no
  verb=updated
fi

# 1. Skip, or refuse, before anything is changed.
if [ -z "$url" ] || ! [[ "$UMAMI_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  report "WARNING: Umami was not $verb: NEXT_PUBLIC_SERVER_URL in .env.local gives no usable domain for its address"
  exit 0
fi

# Whether Umami itself runs: a running database alone is not Umami, and starting Umami on a
# database that came back empty gives it the default admin password. When it isn't running its
# public address is closed, before any skip below: a start by hand later must not be public.
was_running=no
if command -v docker >/dev/null && umami_running umami; then was_running=yes; fi
if [ "$was_running" = no ]; then
  close_route || {
    report "ERROR: Umami's public address could not be closed, so nothing was started"
    exit 1
  }
  closed_here=yes
fi

missing=()
yet=""
if [ "$first_install" = yes ]; then yet=" yet (#949)"; fi
[ -n "$password" ] || missing+=("the UMAMI_ADMIN_PASSWORD secret is not set$yet")
if ! getent hosts "$UMAMI_HOST" >/dev/null 2>&1; then
  if [ "$first_install" = yes ]; then missing+=("the DNS name $UMAMI_HOST is not set up yet (#949)"); else missing+=("the DNS name $UMAMI_HOST does not resolve right now"); fi
fi
if [ "${#missing[@]}" -gt 0 ]; then
  printf -v list '%s and ' "${missing[@]}"
  report "Umami was not $verb: ${list% and }; its public address was not changed beyond closing it if Umami isn't running, and the deploy is not affected"
  exit 0
fi
if [ "${#password}" -lt "$MIN_PASSWORD_LENGTH" ] || [[ "$password" == *[[:cntrl:]]* ]]; then
  report "WARNING: Umami was not $verb: UMAMI_ADMIN_PASSWORD must be at least $MIN_PASSWORD_LENGTH characters with no line breaks; Umami is never started with a weak admin password"
  exit 0
fi
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  report "WARNING: Umami was not $verb: Docker with the compose plugin is not available on this server"
  exit 0
fi

if [ "$was_running" = no ]; then
  free_kb=$(awk '$1 == "MemAvailable:" { print $2 }' "$MEMINFO" 2>/dev/null || true)
  if [ "${free_kb:-0}" -lt "$MIN_FREE_KB" ]; then
    report "WARNING: Umami was not started: $((${free_kb:-0} / 1024)) MB of memory is available and it needs about $((MIN_FREE_KB / 1024)) MB"
    exit 0
  fi
  if [ "$first_install" = yes ]; then # the first start pulls two images
    disk_kb=$(df -Pk "$DISK_PATH" 2>/dev/null | awk 'NR == 2 { print $4 }' || true)
    if [ "${disk_kb:-0}" -lt "$MIN_DISK_KB" ]; then
      report "WARNING: Umami was not installed: $((${disk_kb:-0} / 1024)) MB of disk is free where Docker keeps its images and it needs about $((MIN_DISK_KB / 1024)) MB"
      exit 0
    fi
  fi
fi

# 2. A way back before anything changes.
if [ "$first_install" = yes ]; then
  if [ "${PRE_DEPLOY_BACKUP_DONE:-}" != yes ]; then
    bash "$here/backup.sh" pre-deploy || {
      report "ERROR: Umami was not installed: the pre-deploy backup failed"
      exit 1
    }
  fi
elif umami_running db; then
  bash "$here/backup-umami.sh" pre-deploy || report "WARNING: the Umami database dump before this update failed; continuing"
fi

# 3. Settings and containers (the address was closed above if Umami wasn't running).
mkdir -p "$UMAMI_DIR"
chmod 700 "$UMAMI_DIR"
env_file="$UMAMI_DIR/.env"
saved() { sed -n "s/^$1=//p" "$env_file" 2>/dev/null | tail -n 1 || true; }
# The saved value, or a new random one (hex: safe in a URL and a file). Fails rather than prints
# anything else, so an empty secret is never written.
secret_or_new() { # <name>
  local value
  value=$(saved "$1")
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || value=$(openssl rand -hex 32 2>/dev/null || true)
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || return 1
  printf '%s' "$value"
}
db_password=$(secret_or_new UMAMI_DB_PASSWORD) && app_secret=$(secret_or_new UMAMI_APP_SECRET) &&
  two_factor_key=$(secret_or_new UMAMI_TWO_FACTOR_KEY) || {
  report "ERROR: Umami was not $verb: could not generate its secrets (openssl failed); nothing was started"
  exit 1
}
{
  echo "# Written by ops/install-umami.sh on every deploy; the secrets are kept, never printed or committed."
  echo "UMAMI_PORT=$UMAMI_PORT"
  echo "UMAMI_DB_PASSWORD=$db_password"
  echo "UMAMI_APP_SECRET=$app_secret"
  echo "UMAMI_TWO_FACTOR_KEY=$two_factor_key"
} >"$env_file.new"
mv -f "$env_file.new" "$env_file"
install -m 644 "$here/umami/compose.yaml" "$UMAMI_DIR/compose.yaml"

started=yes
# Compose's own messages stay out of the public log; `docker compose logs` on the server has them.
umami_compose up -d --quiet-pull >/dev/null 2>&1 || fail_closed "docker compose could not start Umami (see docker compose logs in $UMAMI_DIR)"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
deadline=$((SECONDS + UP_WAIT))
until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$base/api/heartbeat" || true)" = 200 ]; do
  [ "$SECONDS" -lt "$deadline" ] || fail_closed "Umami did not answer on 127.0.0.1 within ${UP_WAIT}s (see docker compose logs in $UMAMI_DIR)"
  sleep 2
done
report "Umami $verb and answering on 127.0.0.1:$UMAMI_PORT"

# 4. The admin password.
secure_admin_password "$password"
secured=yes

# 5. Open it, and look at it the way a visitor would.
open_route || exit 0 # the warning says why; Umami is only on 127.0.0.1
# shellcheck disable=SC2086 # PUBLIC_CURL_ARGS is a list of curl arguments
public_status() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 $PUBLIC_CURL_ARGS "$@" || true; }
deadline=$((SECONDS + PUBLIC_WAIT))
until [ "$(public_status "$PUBLIC_BASE/api/heartbeat")" = 200 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    report "WARNING: https://$UMAMI_HOST did not answer within ${PUBLIC_WAIT}s; Caddy may still be getting its certificate, or the DNS record does not point at this server"
    exit 0
  fi
  sleep 2
done
public_login=$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USER" "$DEFAULT_PASSWORD" | public_status -X POST -H 'Content-Type: application/json' --data-binary @- "$PUBLIC_BASE/api/auth/login")
[ "$public_login" = 401 ] || fail_closed "https://$UMAMI_HOST answered $public_login to the default admin password, not 401"
report "Umami is live at https://$UMAMI_HOST; its default admin password is rejected there"
