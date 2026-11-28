#!/usr/bin/env bash
# Puts an earlier release back live, by hand (#245). Run the copy inside the release to go back to:
#
#   bash /var/www/sprecher-east/releases/<release>/ops/rollback.sh
#
# `ls -lt /var/www/sprecher-east/releases` lists them, newest first; `readlink current` shows the
# live one. Its cached pages are dropped first (they are from when it last ran), then `current`
# switches to it and the app reloads. If it doesn't answer with its build, the release that was
# live comes back. The database is not rolled back: if the newer release ran a migration the
# older code can't read, restore the pre-deploy backup as well (ops/README.md).
set -Eeuo pipefail
trap '' HUP # a dropped SSH session must not stop the script between the switch and a switch back

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/releases-lib.sh"

UP_SECONDS="${UP_SECONDS:-90}"
target="releases/$(basename "$CODE_DIR")"
live=$(readlink "$APP_DIR/current" 2>/dev/null || true)

if [ "$CODE_DIR" != "$APP_DIR/$target" ] || [ ! -f "$CODE_DIR/.next/BUILD_ID" ]; then
  report "ERROR: run rollback.sh from a release in $APP_DIR/releases"
  exit 1
fi
# Only a release that was set up for this server (deploy-release.sh links the shared files).
if [ ! -L "$CODE_DIR/.env.local" ] || [ ! -L "$CODE_DIR/data" ]; then
  report "ERROR: $target was never set up on this server (no links to .env.local and data/), so it can't be rolled back to"
  exit 1
fi
if [ "$live" = "$target" ]; then
  report "$target is already live; nothing to do"
  exit 0
fi
build_id=$(cat "$CODE_DIR/.next/BUILD_ID")

drop_page_cache "$CODE_DIR"
point_current_at "$target"
# The reload and the check together: a failure of either switches back below.
if pm2 reload "$APP_NAME" --update-env >/dev/null 2>&1 && wait_until_up "$UP_SECONDS" "$build_id"; then
  touch "$CODE_DIR" # newest again, so the next deploy keeps it
  report "rolled back to $target (build $build_id); it answers through Caddy"
  exit 0
fi

if [ -n "$live" ]; then
  point_current_at "$live"
  pm2 reload "$APP_NAME" --update-env >/dev/null 2>&1 || true
  report "ERROR: $target did not reload, or did not answer with its build within ${UP_SECONDS}s; switched back to $live"
else
  report "ERROR: $target did not reload, or did not answer with its build within ${UP_SECONDS}s"
fi
exit 1
