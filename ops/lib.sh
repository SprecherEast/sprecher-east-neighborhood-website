# shellcheck shell=bash
# Shared helpers for the ops scripts. Sourced, not run: . "$(dirname "$0")/lib.sh"
#
# The scripts run inside the deploy's SSH step. Lines they print as `::notice` or `::warning`
# become annotations on the deploy run, on success and on failure alike, so the result can be
# read without opening the logs. The deploy log is public: never print secrets or file contents.

# Which environment the scripts act on (#1073): production unless PREVIEW_NUMBER names a pull request
# preview. It sets APP_DIR, APP_NAME (the PM2 process), APP_PORT, ENV_FILE, DATA_DIR, MEDIA_DIR,
# SITE_URL (previews), CADDY_SITE_FILE and KEEP_RELEASES, once, for every script. The deploy
# workflow sends environment.sh ahead of this file, where it can't be sourced.
[ -n "${ENVIRONMENT_LOADED:-}" ] || . "$(dirname "${BASH_SOURCE[0]}")/environment.sh"

# APP_DIR holds what outlives a release: .env.local, data/ (the database), public/media (uploads),
# releases/ and the `current` link to the live release (#245). CODE_DIR is the release (or
# checkout) these scripts came from, with its build, node_modules and ecosystem.config.cjs.
CODE_DIR="${CODE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# The Caddy files the Caddy scripts and install-umami.sh work on, and how they reload it. One
# definition each; the environment overrides them in tests.
# shellcheck disable=SC2034 # used by the scripts that source this file
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
# shellcheck disable=SC2034
HSTS_FILE="${HSTS_FILE:-/etc/caddy/sprecher-east-hsts.caddy}" # a copy of ops/caddy/hsts.caddy (caddy-https.sh)
# shellcheck disable=SC2034
RELOAD_CADDY="${RELOAD_CADDY:-systemctl reload caddy}"
# The request body limit file caddy-limits.sh installs; the preview site block imports it too (#959).
# shellcheck disable=SC2034
LIMITS_FILE="${LIMITS_FILE:-/etc/caddy/sprecher-east-form-limits.caddy}"
# Where this environment's site block lives: production's is the Caddyfile itself, a preview's is
# its own file in PREVIEW_CADDY_DIR (environment.sh).
# shellcheck disable=SC2034
CADDY_SITE_FILE="${CADDY_SITE_FILE:-$CADDYFILE}"
# Pull request previews (#1072): the copy of ops/caddy/preview-headers.caddy the preview blocks import.
# shellcheck disable=SC2034
PREVIEW_HEADERS_FILE="${PREVIEW_HEADERS_FILE:-/etc/caddy/sprecher-east-preview-headers.caddy}"

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
  [ -r "$ENV_FILE" ] || return 0
  sed -n -E "s/^[[:space:]]*(export[[:space:]]+)?$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" |
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

# Reloads Caddy, then gives the site time to answer. Prints what went wrong (nothing when all is
# well), for the caller to roll back and report.
caddy_reload_problem() { # <what the config now has> [seconds the site gets to answer, default 20]
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    echo "Caddy would not reload with $1"
  elif ! wait_until_up "${2:-20}"; then
    echo "the site stopped answering after adding $1"
  fi
}

# True when the Caddyfile has an `import <target>` line, however it was indented, spaced or
# commented by hand.
caddy_import_present() { # <the path or glob that is imported>
  awk -v want="$1" '{ sub(/#.*/, "") } $1 == "import" && $2 == want && NF == 2 { found = 1 } END { exit !found }' "$CADDYFILE" 2>/dev/null
}

# The Caddyfile plus one top-level import line (and its comment), to validate before it replaces the
# Caddyfile. Prints it; the caller sends it to a file.
caddy_with_import() { # <comment> <import line>
  cat "$CADDYFILE" && printf '\n# %s\n%s\n' "$1" "$2"
}

# Installs a Caddy file the repo manages, keeping the previous copy for a rollback. Sets
# $CADDY_FILE_BACKUP to that copy's path (empty when there was none).
caddy_install_file() { # <source> <target>
  CADDY_FILE_BACKUP=""
  if [ -f "$2" ]; then
    CADDY_FILE_BACKUP=$(mktemp "$2.previous-XXXXXX")
    cp -p "$2" "$CADDY_FILE_BACKUP"
  fi
  install -m 644 "$1" "$2"
}

# Puts the previous copy back, or removes the file when there was none.
caddy_restore_file() { # <target> <previous copy, or empty>
  if [ -n "$2" ]; then cp -p "$2" "$1" && rm -f "$2"; else rm -f "$1"; fi
}

# After Caddy rejected a change: puts the managed file back and reports it.
caddy_report_rejected() { # <what was rejected> <the file's name in the message> <target> <previous copy, or empty>
  if caddy_restore_file "$3" "$4"; then
    report "ERROR: Caddy rejected $1; nothing was changed"
  else
    report "ERROR: Caddy rejected $1, and the previous $2 could not be put back (copy: $4)"
  fi
}

# Puts a Caddy change back: the Caddyfile from its backup (when one is given), the caller's own
# files, then a reload. Prints what could not be put back, and returns 1, if anything.
caddy_roll_back() { # <Caddyfile backup, or empty> <function that restores the caller's files: on failure it prints what it could not and returns 1>
  local failed="" own
  # cp reads the backup before it truncates the Caddyfile, so an unreadable backup can't empty it.
  if [ -n "$1" ] && ! cp "$1" "$CADDYFILE"; then failed="the Caddyfile (backup: $1)"; fi
  if ! own=$("$2"); then failed="${failed:+$failed and }$own"; fi
  if [ -n "$failed" ]; then
    echo "Could not put back $failed."
    return 1
  fi
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    echo "The previous files are back, but Caddy would not reload them."
    return 1
  fi
}

# Never print Caddy's own output: the Caddyfile could hold credentials and the deploy log is public.
caddy_accepts() { caddy validate --config "$1" --adapter caddyfile >/dev/null 2>&1; }
caddy_version() {
  local v
  v=$(caddy version 2>/dev/null | awk '{ print $1; exit }' || true)
  echo "${v:-unknown}"
}
