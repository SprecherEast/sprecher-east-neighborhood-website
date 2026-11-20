# shellcheck shell=bash
# The environment the ops scripts act on (#1073): production, or one pull request preview named by
# its number in PREVIEW_NUMBER. Sourced by lib.sh. The deploy workflow also sends this file ahead of
# lib.sh to `bash -s` over SSH, where nothing can be sourced, so it must stand alone.
#
# Every value that differs between environments is defined here once, and the scripts read it from
# here; none of them writes a folder, process name, port or address of its own. With no
# PREVIEW_NUMBER every value is production's, as before previews existed. A preview takes nothing
# from a caller's APP_DIR, APP_NAME, APP_PORT, SITE_URL or CADDY_SITE_FILE: all of it derives from
# the number, so a preview can never be pointed at production's folder, process or address.
# shellcheck disable=SC2034 # the scripts that source this file use what it sets

ENVIRONMENT_LOADED=yes

# Production's folder, and the folder one folder per preview sits in. Outside production's folder.
PRODUCTION_DIR=/var/www/sprecher-east
PREVIEW_ROOT="${PREVIEW_ROOT:-/var/www/sprecher-east-previews}"
PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-dev.sprechereast.com}" # a preview is pr-<number>.<this>
# The folder of per-preview Caddy site blocks the Caddyfile imports (#1072, ops/previews.md).
PREVIEW_CADDY_DIR="${PREVIEW_CADDY_DIR:-/etc/caddy/previews}"
# The loopback ports previews listen on: one range that excludes production's (3000) and Umami's
# (3100, UMAMI_PORT in umami-lib.sh). The deploy workflow's port check reads these two values too.
PREVIEW_PORT_MIN="${PREVIEW_PORT_MIN:-3200}"
PREVIEW_PORT_MAX="${PREVIEW_PORT_MAX:-3999}"
# Ports no preview may take: production's app and Umami (a test ties both to their own files).
RESERVED_PORTS="3000 3100"

PREVIEW_NUMBER="${PREVIEW_NUMBER:-}"
if [ -z "$PREVIEW_NUMBER" ]; then
  ENVIRONMENT=production
  APP_DIR="${APP_DIR:-$PRODUCTION_DIR}"
  APP_NAME=sprecher-east # the PM2 process
  APP_PORT="${APP_PORT:-3000}"
  KEEP_RELEASES="${KEEP_RELEASES:-3}"
  CADDY_SITE_FILE="" # lib.sh points it at the Caddyfile, which holds production's site block
else
  # A pull request number: no sign, no leading zero, no blanks, at most six digits. The value is
  # never printed: the deploy log is public.
  [[ "$PREVIEW_NUMBER" =~ ^[1-9][0-9]{0,5}$ ]] || {
    echo "::error title=Server::PREVIEW_NUMBER is not a pull request number"
    exit 1
  }
  # An absolute folder that is neither production's nor inside it, compared after `realpath -m`
  # resolves `//`, `.`, `..` and symlinks (the folder need not exist yet).
  if [[ "$PREVIEW_ROOT" == /* ]]; then
    PREVIEW_ROOT=$(realpath -m -- "$PREVIEW_ROOT")
    case "$PREVIEW_ROOT" in
      / | "$(realpath -m -- "$PRODUCTION_DIR")" | "$(realpath -m -- "$PRODUCTION_DIR")"/*) PREVIEW_ROOT="" ;;
    esac
  fi
  [[ "$PREVIEW_ROOT" == /* ]] || {
    echo "::error title=Server::PREVIEW_ROOT must be a folder outside production's"
    exit 1
  }
  [[ "$PREVIEW_DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || {
    echo "::error title=Server::PREVIEW_DOMAIN is not a host name"
    exit 1
  }
  # Two ports (no sign, no leading zero, at most 65535), lowest first, with no reserved port between.
  [[ "$PREVIEW_PORT_MIN" =~ ^[1-9][0-9]{0,4}$ && "$PREVIEW_PORT_MAX" =~ ^[1-9][0-9]{0,4}$ ]] &&
    [ "$PREVIEW_PORT_MAX" -le 65535 ] && [ "$PREVIEW_PORT_MIN" -le "$PREVIEW_PORT_MAX" ] || {
    echo "::error title=Server::the preview port range is not two ports, lowest first"
    exit 1
  }
  for reserved in $RESERVED_PORTS; do
    if [ "$reserved" -ge "$PREVIEW_PORT_MIN" ] && [ "$reserved" -le "$PREVIEW_PORT_MAX" ]; then
      echo "::error title=Server::the preview port range includes a port that is not for previews"
      exit 1
    fi
  done
  ENVIRONMENT="preview-$PREVIEW_NUMBER"
  APP_DIR="${PREVIEW_ROOT%/}/pr-$PREVIEW_NUMBER"
  APP_NAME="sprecher-east-pr-$PREVIEW_NUMBER"
  APP_PORT=$((PREVIEW_PORT_MIN + PREVIEW_NUMBER % (PREVIEW_PORT_MAX - PREVIEW_PORT_MIN + 1)))
  KEEP_RELEASES="${KEEP_RELEASES:-2}"
  SITE_URL="https://pr-$PREVIEW_NUMBER.$PREVIEW_DOMAIN" # what the health check asks for
  CADDY_SITE_FILE="${PREVIEW_CADDY_DIR%/}/pr-$PREVIEW_NUMBER.caddy"
fi

# What step 2 of a deploy links into each release, and what env_value reads.
ENV_FILE="$APP_DIR/.env.local"
DATA_DIR="$APP_DIR/data"
MEDIA_DIR="$APP_DIR/public/media"

# Child scripts (restart-app.sh, rollback.sh) and PM2 (ecosystem.config.cjs) read the same values.
export APP_DIR APP_NAME APP_PORT PREVIEW_NUMBER PREVIEW_ROOT PREVIEW_DOMAIN PREVIEW_CADDY_DIR
export PREVIEW_PORT_MIN PREVIEW_PORT_MAX

is_preview() { [ -n "$PREVIEW_NUMBER" ]; }

# True when nothing on this machine listens on the port. A connection that is refused means free.
port_is_free() { # <port>
  ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}
