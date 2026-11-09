# shellcheck shell=bash
# Shared helpers for the ops scripts. Sourced, not run: . "$(dirname "$0")/lib.sh"
#
# The scripts run inside the deploy's SSH step. Lines they print as `::notice` or `::warning`
# become annotations on the deploy run, on success and on failure alike, so the result can be
# read without opening the logs. The deploy log is public: never print secrets or file contents.

# APP_DIR holds what outlives a release: .env.local, data/ (the database), public/media (uploads),
# releases/ and the `current` link to the live release (#245). CODE_DIR is the release (or
# checkout) these scripts came from, with its build, node_modules and ecosystem.config.cjs.
APP_DIR="${APP_DIR:-/var/www/sprecher-east}"
CODE_DIR="${CODE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# shellcheck disable=SC2034 # used by the scripts that source this file
APP_NAME=sprecher-east # the PM2 process

# The Caddy files the Caddy scripts and install-umami.sh work on, and how they reload it. One
# definition each; the environment overrides them in tests.
# shellcheck disable=SC2034 # used by the scripts that source this file
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
# shellcheck disable=SC2034
HSTS_FILE="${HSTS_FILE:-/etc/caddy/sprecher-east-hsts.caddy}" # a copy of ops/caddy/hsts.caddy (caddy-https.sh)
# shellcheck disable=SC2034
RELOAD_CADDY="${RELOAD_CADDY:-systemctl reload caddy}"

# report "message" → notice; "WARNING: …" → warning; "ERROR: …" → error.
report() {
  case "$*" in
    ERROR:*) echo "::error title=Server::$*" ;;
    WARNING:*) echo "::warning title=Server::$*" ;;
    *) echo "::notice title=Server::$*" ;;
  esac
}

# One annotation spanning several lines (read from stdin), so details don't use up the few
# annotations GitHub shows per step. Level: notice, warning or error.
report_lines() { # <level> <title>
  local text
  text=$(cat)
  text=${text//'%'/'%25'}
  text=${text//$'\r'/'%0D'}
  text=${text//$'\n'/'%0A'}
  echo "::$1 title=$2::$text"
}

# The value of a setting in .env.local (last one wins; `export`, quotes and a trailing
# ` # comment` removed). Prints nothing if unset.
# Only for non-secret settings: the value must never be printed.
env_value() {
  [ -r "$APP_DIR/.env.local" ] || return 0
  sed -n -E "s/^[[:space:]]*(export[[:space:]]+)?$1[[:space:]]*=[[:space:]]*//p" "$APP_DIR/.env.local" |
    tail -n 1 | tr -d "\r" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]*$//' | tr -d "\"'"
}

# The site's public origin, e.g. https://sprechereast.com, from SITE_URL or the app's own
# NEXT_PUBLIC_SERVER_URL. Prints nothing if neither is set.
site_url() {
  local url="${SITE_URL:-$(env_value NEXT_PUBLIC_SERVER_URL)}" scheme rest
  [ -n "$url" ] || return 0
  case "$url" in
    *://*)
      scheme="${url%%://*}"
      rest="${url#*://}"
      ;;
    *)
      scheme=https
      rest="$url"
      ;;
  esac
  rest="${rest%%/*}"
  printf '%s://%s' "$scheme" "${rest%%\?*}"
}

# A request to the public site, sent to Caddy on this machine rather than out through DNS. Extra
# curl arguments follow the path. Fails when no site address is known or nothing answers.
site_curl() { # <path> [curl args…]
  local path="$1" url hostport host port
  shift
  url=$(site_url)
  [ -n "$url" ] || return 1
  hostport="${url#*://}"
  host="${hostport%%:*}"
  port="${hostport##*:}"
  if [ "$port" = "$hostport" ]; then
    if [ "${url%%://*}" = http ]; then port=80; else port=443; fi
  fi
  curl -s --max-time 15 --resolve "$host:$port:127.0.0.1" "$@" "$url$path"
}

# The HTTP status of a request to the public site (as site_curl). Extra curl arguments (method,
# body) follow the path. Prints 000 when nothing answers or no site address is known.
site_status() { # <path> [curl args…]
  local path="$1" code
  shift
  code=$(site_curl "$path" -o /dev/null -w '%{http_code}' "$@" || true)
  echo "${code:-000}"
}

# The build ID the running app reports at /api/version. Prints nothing if it doesn't answer.
site_build_id() {
  { site_curl /api/version || true; } | sed -n 's/.*"buildId":"\([^"]*\)".*/\1/p'
}

# One start setting of the app (args or cwd) as PM2 has it stored. Prints nothing if PM2 doesn't
# know the app.
pm2_stored() { # args|cwd
  pm2 jlist 2>/dev/null | node -e '
    let raw = ""
    process.stdin.on("data", (d) => (raw += d)).on("end", () => {
      let apps = []
      try { apps = JSON.parse(raw) } catch {}
      const env = apps.find((p) => p.name === process.argv[1])?.pm2_env ?? {}
      const value = process.argv[2] === "cwd" ? env.pm_cwd : env.args
      console.log(Array.isArray(value) ? value.join(" ") : value || "")
    })' "$APP_NAME" "$1"
}

# Writes a PM2 config for the app: ecosystem.config.cjs with the given start arguments and
# folder, the way back to settings PM2 had before. Prints the file's path.
pm2_config_with() { # <args> <cwd>
  local out
  out=$(mktemp /tmp/sprecher-east-rollback-XXXXXX.config.cjs)
  node -e '
    const fs = require("fs")
    const [file, name, args, cwd, out] = process.argv.slice(1)
    const config = require(file)
    config.apps = config.apps.filter((a) => a.name === name).map((a) => ({ ...a, args, cwd }))
    fs.writeFileSync(out, "module.exports = " + JSON.stringify(config, null, 2) + "\n")
  ' "$CODE_DIR/ecosystem.config.cjs" "$APP_NAME" "$1" "$2" "$out"
  echo "$out"
}

# True when the public home page answers 200 through Caddy on this machine. A redirect doesn't
# count: Caddy can answer one without ever reaching the app. With a build ID, the app must also
# report that build, which proves the release that was just switched to is the one serving.
site_is_up() { # [build id]
  [ "$(site_status /)" = 200 ] || return 1
  [ -z "${1:-}" ] || [ "$(site_build_id)" = "$1" ]
}

# True once the site is up (as site_is_up), waiting up to the given number of seconds (default
# 90). Use it right after a restart or reload, while the app may still be starting.
wait_until_up() { # [seconds] [build id]
  local deadline=$((SECONDS + ${1:-90}))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if site_is_up "${2:-}"; then return 0; fi
    sleep 2
  done
  return 1
}

# Points `current` at a target relative to $APP_DIR, atomically: a new link renamed over the old.
point_current_at() {
  ln -sfn "$1" "$APP_DIR/.current-new"
  mv -Tf "$APP_DIR/.current-new" "$APP_DIR/current"
}

# Pages prerendered at build time, and the data cache. Next renders a page that has no cached
# copy on its first request and caches it from then on, with each page's own revalidate time.
drop_page_cache() { # <release dir>
  local app="$1/.next/server/app"
  [ -d "$app" ] || return 0
  find "$app" -type f \( -name '*.html' -o -name '*.rsc' -o -name '*.meta' -o -name '*.body' \) -delete
  find "$app" -type d -name '*.segments' -prune -exec rm -rf {} +
  rm -rf "$1/.next/cache"
}

# Never print Caddy's own output: the Caddyfile could hold credentials and the deploy log is public.
caddy_accepts() { caddy validate --config "$1" --adapter caddyfile >/dev/null 2>&1; }
caddy_version() {
  local v
  v=$(caddy version 2>/dev/null | awk '{ print $1; exit }' || true)
  echo "${v:-unknown}"
}
