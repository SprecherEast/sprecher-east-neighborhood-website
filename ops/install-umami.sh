#!/usr/bin/env bash
# Installs and updates Umami analytics (#948), run by every deploy once the release is live and
# the Caddy settings are in place (ops/deploy-release.sh). Umami and its Postgres database run
# as two containers from ops/umami/compose.yaml, in /var/www/umami, listening on 127.0.0.1 only.
# Caddy is the only public way in (ops/caddy/umami.caddy), and only after the default admin
# password is gone, so Umami is never reachable with it.
#
# Environment: UMAMI_ADMIN_PASSWORD, the GitHub secret of that name, sent over the SSH session by
# the workflow (never an argument or a file). The script does nothing, says why in a `::notice`,
# and exits 0 (the deploy still succeeds) while the secret or the DNS name is missing.
#
# Steps, each reported as an annotation (never a secret value):
#   1. skip (exit 0) when the secret or the stats DNS name is missing, the password is weak, or
#      Docker is missing; refuse (exit 0, warning) on first install when free memory is short
#   2. first install only: back up (ops/backup.sh pre-deploy); later runs dump Umami's database
#   3. write /var/www/umami/.env (generated passwords, kept between runs) and compose.yaml, start
#      the containers, wait until Umami answers on 127.0.0.1
#   4. replace the default admin password with the secret, then check that the default is rejected
#   5. only then add the Caddy block, check it answers over HTTPS and rejects the default password
# A failure from step 2 on exits 1. Umami is not exposed unless step 4 succeeded.
#
# Test seams (all default to the server's real values): UMAMI_DIR, UMAMI_PORT, UMAMI_HOST,
# CADDYFILE, UMAMI_CADDY_FILE, HSTS_FILE, RELOAD_CADDY, MEMINFO, MIN_FREE_KB, UP_WAIT, PUBLIC_WAIT,
# PUBLIC_BASE and PUBLIC_CURL_ARGS (how the public address is reached from the server itself).
set -Eeuo pipefail
umask 077
trap '' HUP

. "$(dirname "$0")/lib.sh"

on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "ERROR: install-umami.sh failed unexpectedly at line $1; Umami is exposed only if an earlier step reported it"
  exit 1
}
trap 'on_unexpected_error $LINENO' ERR

UMAMI_DIR="${UMAMI_DIR:-/var/www/umami}"
UMAMI_PORT="${UMAMI_PORT:-3100}" # the one definition: written to .env for compose, filled into the Caddy block
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
UMAMI_CADDY_FILE="${UMAMI_CADDY_FILE:-/etc/caddy/sprecher-east-umami.caddy}"
HSTS_FILE="${HSTS_FILE:-/etc/caddy/sprecher-east-hsts.caddy}"
RELOAD_CADDY="${RELOAD_CADDY:-systemctl reload caddy}"
MEMINFO="${MEMINFO:-/proc/meminfo}"
MIN_FREE_KB="${MIN_FREE_KB:-1048576}" # about 1 GB for Umami and its database; the server has 4 GB
UP_WAIT="${UP_WAIT:-120}"             # seconds Umami may take to answer after it starts
PUBLIC_WAIT="${PUBLIC_WAIT:-60}"      # seconds Caddy may take to get the certificate
MIN_PASSWORD_LENGTH=12
DEFAULT_PASSWORD='umami' # Umami's documented first login: admin / umami (docs.umami.is/docs/install)
ADMIN_USER='admin'
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

# 1. Skip, or refuse, before anything is changed.
if [ -z "$url" ] || ! [[ "$UMAMI_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  report "WARNING: Umami was not installed: NEXT_PUBLIC_SERVER_URL in .env.local gives no usable domain for its address"
  exit 0
fi
missing=()
[ -n "$password" ] || missing+=("the UMAMI_ADMIN_PASSWORD secret")
getent hosts "$UMAMI_HOST" >/dev/null 2>&1 || missing+=("the DNS name $UMAMI_HOST")
if [ "${#missing[@]}" -gt 0 ]; then
  printf -v list '%s and ' "${missing[@]}"
  report "Umami was not installed: ${list% and } not set up yet (#949); the deploy is not affected"
  exit 0
fi
if [ "${#password}" -lt "$MIN_PASSWORD_LENGTH" ] || [[ "$password" == *[[:cntrl:]]* ]]; then
  report "WARNING: Umami was not installed: UMAMI_ADMIN_PASSWORD must be at least $MIN_PASSWORD_LENGTH characters with no line breaks; Umami is never started with a weak admin password"
  exit 0
fi
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  report "WARNING: Umami was not installed: Docker with the compose plugin is not available on this server"
  exit 0
fi

compose() { docker compose --project-directory "$UMAMI_DIR" "$@"; }
running() { [ -n "$({ compose ps --status running -q 2>/dev/null || true; } | head -n 1)" ]; }

first_install=no
[ -f "$UMAMI_DIR/.env" ] || first_install=yes
if ! running; then
  free_kb=$(awk '$1 == "MemAvailable:" { print $2 }' "$MEMINFO" 2>/dev/null || true)
  if [ "${free_kb:-0}" -lt "$MIN_FREE_KB" ]; then
    report "WARNING: Umami was not started: $(((${free_kb:-0}) / 1024)) MB of memory is available and it needs about $((MIN_FREE_KB / 1024)) MB"
    exit 0
  fi
fi

# 2. A way back before anything changes.
if [ "$first_install" = yes ]; then
  bash "$CODE_DIR/ops/backup.sh" pre-deploy || {
    report "ERROR: Umami was not installed: the pre-deploy backup failed"
    exit 1
  }
elif running; then
  bash "$CODE_DIR/ops/backup-umami.sh" pre-deploy || report "WARNING: the Umami database dump before this update failed; continuing"
fi

# 3. Settings, containers.
mkdir -p "$UMAMI_DIR"
chmod 700 "$UMAMI_DIR"
env_file="$UMAMI_DIR/.env"
saved() { sed -n "s/^$1=//p" "$env_file" 2>/dev/null | tail -n 1 || true; }
secret_or_new() { # <name>: the saved value, or a new random one (hex: safe in a URL and a file)
  local value
  value=$(saved "$1")
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || value=$(openssl rand -hex 32)
  printf '%s' "$value"
}
{
  echo "# Written by ops/install-umami.sh on every deploy; the secrets are kept, never printed or committed."
  echo "UMAMI_PORT=$UMAMI_PORT"
  echo "UMAMI_DB_PASSWORD=$(secret_or_new UMAMI_DB_PASSWORD)"
  echo "UMAMI_APP_SECRET=$(secret_or_new UMAMI_APP_SECRET)"
  echo "UMAMI_TWO_FACTOR_KEY=$(secret_or_new UMAMI_TWO_FACTOR_KEY)"
} >"$env_file.new"
mv -f "$env_file.new" "$env_file"
install -m 644 "$CODE_DIR/ops/umami/compose.yaml" "$UMAMI_DIR/compose.yaml"

# Compose's own messages stay out of the public log; `docker compose logs` on the server has them.
if ! compose up -d --quiet-pull >/dev/null 2>&1; then
  report "ERROR: docker compose could not start Umami (see docker compose logs in $UMAMI_DIR); it is not exposed"
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

deadline=$((SECONDS + UP_WAIT))
until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$base/api/heartbeat" || true)" = 200 ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    report "ERROR: Umami did not answer on 127.0.0.1 within ${UP_WAIT}s (see docker compose logs in $UMAMI_DIR); it is not exposed"
    exit 1
  fi
  sleep 2
done
report "Umami $([ "$first_install" = yes ] && echo installed || echo updated) and answering on 127.0.0.1:$UMAMI_PORT"

# 4. The admin password. Requests are described in a curl config file and the body in a file in
# a private folder, so no password or token appears in a command line or the log.
# Sets `code` (HTTP status, 000 if none) and leaves the answer in $work/answer.
api() { # <method> <path> [body file] [token]
  {
    echo 'silent'
    echo 'max-time = 20'
    echo "url = \"$base$2\""
    echo "request = \"$1\""
    echo 'header = "Content-Type: application/json"'
    echo "output = \"$work/answer\""
    echo 'write-out = "%{http_code}"'
    [ -z "${3:-}" ] || echo "data-binary = \"@$3\""
    [ -z "${4:-}" ] || echo "header = \"Authorization: Bearer $4\""
  } >"$work/request.cfg"
  : >"$work/answer"
  code=$(curl -K "$work/request.cfg" 2>/dev/null || true)
  code="${code:-000}"
}
json_body() { # <file> <field=VALUE_VAR…>: a JSON object whose values come from environment variables
  node -e '
    const body = {}
    for (const pair of process.argv.slice(1)) { const [k, v] = pair.split("="); body[k] = process.env[v] ?? "" }
    process.stdout.write(JSON.stringify(body))' "${@:2}" >"$1"
}
token_in_answer() { node -e 'try { process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).token || "") } catch {}' "$work/answer"; }
# Sets `code`, and `token` when the login worked.
login() { # <password>
  ADMIN_USER="$ADMIN_USER" LOGIN_PASSWORD="$1" json_body "$work/login.json" username=ADMIN_USER password=LOGIN_PASSWORD
  api POST /api/auth/login "$work/login.json"
  token=""
  [ "$code" != 200 ] || token=$(token_in_answer)
  [ "$code" != 200 ] || [ -n "$token" ] || code=000 # a 200 without a token is not a login
}
unexpected() { # <what>
  report "ERROR: Umami's $1 answered $code, not what its API documents; it is not exposed"
  exit 1
}

login "$password"
case "$code" in
  200) report "Umami's admin password is already the one in the secret" ;;
  401)
    login "$DEFAULT_PASSWORD"
    case "$code" in
      200)
        ADMIN_CURRENT="$DEFAULT_PASSWORD" ADMIN_NEW="$password" json_body "$work/change.json" currentPassword=ADMIN_CURRENT newPassword=ADMIN_NEW
        api POST /api/me/password "$work/change.json" "$token"
        [ "$code" = 200 ] || unexpected "change of the default admin password"
        login "$password"
        [ "$code" = 200 ] || unexpected "login with the new admin password"
        report "Umami's default admin password was replaced with the one in the secret"
        ;;
      401) report "Umami's admin password is neither the default nor the one in the secret (changed by hand); left as it is" ;;
      *) unexpected "login" ;;
    esac
    ;;
  *) unexpected "login" ;;
esac
login "$DEFAULT_PASSWORD"
[ "$code" = 401 ] || {
  report "ERROR: Umami still accepts its default admin password (login answered $code); it is not exposed"
  exit 1
}
report "Umami rejects its default admin password"

# 5. Caddy. Only a block this script owns is added to the Caddyfile: one `import` line at the end.
exposed=no
expose() {
  local import_line="import $UMAMI_CADDY_FILE" stamp new old=""
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then
    report "WARNING: Caddy or $CADDYFILE not found, so Umami is running but not exposed"
    return 0
  fi
  if [ ! -f "$HSTS_FILE" ]; then
    report "WARNING: $HSTS_FILE not found (ops/caddy-https.sh writes it), so Umami is running but not exposed"
    return 0
  fi
  new=$(mktemp "$UMAMI_CADDY_FILE.XXXXXX")
  sed -e "s/__UMAMI_HOST__/$UMAMI_HOST/" -e "s/__UMAMI_PORT__/$UMAMI_PORT/" "$CODE_DIR/ops/caddy/umami.caddy" >"$new"
  chmod 644 "$new"
  if [ -f "$UMAMI_CADDY_FILE" ]; then old=$(mktemp "$UMAMI_CADDY_FILE.XXXXXX"); cp -p "$UMAMI_CADDY_FILE" "$old"; fi
  local candidate="" changed=no
  if ! cmp -s "$new" "$UMAMI_CADDY_FILE" 2>/dev/null; then changed=yes; fi
  mv -f "$new" "$UMAMI_CADDY_FILE"
  if ! grep -qxF "$import_line" "$CADDYFILE"; then
    changed=yes
    candidate=$(mktemp "$CADDYFILE.XXXXXX")
    { cat "$CADDYFILE"; printf '\n# Umami analytics (ops/install-umami.sh, #948)\n%s\n' "$import_line"; } >"$candidate"
    # mktemp makes it root-only; Caddy runs as its own user and must keep reading the Caddyfile
    chmod --reference="$CADDYFILE" "$candidate"
    chown --reference="$CADDYFILE" "$candidate" 2>/dev/null || true
  fi
  restore() { # puts back what was there; the live Caddyfile is only replaced after the check
    if [ -n "$old" ]; then mv -f "$old" "$UMAMI_CADDY_FILE"; else rm -f "$UMAMI_CADDY_FILE"; fi
    [ -z "$candidate" ] || rm -f "$candidate"
  }
  if [ "$changed" = no ]; then
    rm -f "$old"
  elif ! caddy_accepts "${candidate:-$CADDYFILE}"; then
    restore
    report "WARNING: Caddy did not accept the Umami block, so it was left out; Umami is running but not exposed"
    return 0
  elif [ -n "$candidate" ]; then
    cp -p "$CADDYFILE" "$CADDYFILE.bak-umami-$stamp"
    mv -f "$candidate" "$CADDYFILE"
  fi
  if [ "$changed" = yes ] && ! $RELOAD_CADDY >/dev/null 2>&1; then
    [ -z "$candidate" ] || cp -p "$CADDYFILE.bak-umami-$stamp" "$CADDYFILE"
    if [ -n "$old" ]; then mv -f "$old" "$UMAMI_CADDY_FILE"; else rm -f "$UMAMI_CADDY_FILE"; fi
    $RELOAD_CADDY >/dev/null 2>&1 || true
    report "ERROR: Caddy would not reload with the Umami block; it was taken out again"
    exit 1
  fi
  rm -f "$old"
  exposed=yes
}
expose
[ "$exposed" = yes ] || exit 0 # the warning above says why

# What a visitor gets, from this machine: the heartbeat over HTTPS, and the default password refused.
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
if [ "$public_login" != 401 ]; then
  report "ERROR: https://$UMAMI_HOST answered $public_login to the default admin password, not 401"
  exit 1
fi
report "Umami is live at https://$UMAMI_HOST; its default admin password is rejected there"
