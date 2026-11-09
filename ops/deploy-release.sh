#!/usr/bin/env bash
# Puts a release built by GitHub Actions live (#245). The deploy workflow unpacks the build into
# $APP_DIR/releases/<name> and runs this script from there.
#
# Until the switch, nothing the visitors see changes: any failure stops the script and the
# previous release keeps serving. The steps:
#   1. check the release fits this server (Node version, public settings, native modules)
#   2. link the shared .env.local, data/ and public/media into it
#   3. back up the data (ops/backup.sh pre-deploy), then run the database migrations
#   4. drop the pages prerendered in CI, whose database was empty: each renders from the live
#      database on its first visit, then is cached as usual
#   5. switch the `current` link atomically and reload the app under PM2 (ops/restart-app.sh)
#   6. check the site answers through Caddy with this release's build; if not, switch back
#   7. refresh the backup job, the Caddy settings (request limits, HTTPS) and Umami analytics, and keep the newest
#      $KEEP_RELEASES releases
#
# The first run moves the app from the old checkout in $APP_DIR to `current`; the checkout stays
# untouched as the way back (ops/README.md, "Releases").
set -Eeuo pipefail # -E: the ERR trap below also covers failures inside functions
umask 022
trap '' HUP # a dropped SSH session must not stop the script between the switch and a switch back

. "$(dirname "$0")/lib.sh"

# The workflow sends the Umami admin password on stdin and says so with this flag (#948), so a
# run by hand never waits for input. It goes to ops/install-umami.sh only; never an argument.
umami_admin_password=""
if [ "${1:-}" = --umami-password-stdin ]; then
  IFS= read -r -d '' umami_admin_password || true
fi

RELEASE="$CODE_DIR"
RELEASES="$APP_DIR/releases"
CURRENT="$APP_DIR/current"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
UP_SECONDS="${UP_SECONDS:-90}" # how long the app may take to answer after a reload
name=$(basename "$RELEASE")

switched=no # yes once `current` points at this release
previous="" # what `current` pointed at before (releases/<name>), empty for the old checkout
# First run only: PM2's start settings for the old checkout, kept until the new release passes
legacy_args="" legacy_cwd="" legacy_config=""

on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  if [ "$switched" = yes ]; then
    switch_back "deploy-release.sh failed unexpectedly at line $1"
  fi
  report "ERROR: deploy-release.sh failed unexpectedly at line $1 before the switch; the live site was not changed"
  exit 1
}
trap 'on_unexpected_error $LINENO' ERR

stop() {
  # Oldest, so it's pruned first; kept until then to look into. Only inside releases/.
  case "$RELEASE" in "$RELEASES"/*) touch -d @0 "$RELEASE" 2>/dev/null || true ;; esac
  report "ERROR: $*; the live site was not changed (release $name)"
  exit 1
}

# A value from the release's .release-info, written by ops/build-release.sh.
info() { sed -n "s/^$1=//p" "$RELEASE/.release-info" | tail -n 1; }

# Puts the previous release (or the old checkout) back after a failed check, then exits.
switch_back() { # <reason>
  local reason="$1" previous_build
  trap - ERR
  touch -d @0 "$RELEASE" # pruned first, kept until then to look into
  if [ -n "$previous" ]; then
    point_current_at "$previous"
    pm2 reload "$APP_NAME" --update-env >/dev/null 2>&1 || true
    previous_build=$(cat "$APP_DIR/$previous/.next/BUILD_ID" 2>/dev/null || true)
    if wait_until_up "$UP_SECONDS" "$previous_build"; then
      report "ERROR: $reason; switched back to $(basename "$previous"), which is serving again"
    else
      report "ERROR: $reason; switched back to $(basename "$previous"), but the site does not answer; see ops/README.md (Roll back)"
    fi
  else
    # First run. restart-app.sh puts PM2's previous settings back if the new release never
    # answered; if it did answer and a later check failed, PM2 still runs from `current`, so
    # start it again from the old checkout with the settings saved before the switch.
    if [ "$(pm2_stored cwd)" != "$legacy_cwd" ] || [ "$(pm2_stored args)" != "$legacy_args" ]; then
      pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
      pm2 start "$legacy_config" --only "$APP_NAME" >/dev/null 2>&1 || true
      pm2 save --force >/dev/null 2>&1 || true
    fi
    rm -f "$CURRENT"
    if [ "$(pm2_stored cwd)" = "$legacy_cwd" ] && wait_until_up "$UP_SECONDS"; then
      rm -f "$legacy_config"
      report "ERROR: $reason; the old checkout in $APP_DIR is serving again"
    else
      report "ERROR: $reason, and the old checkout is not serving either; by hand: pm2 delete $APP_NAME; pm2 start $legacy_config --only $APP_NAME; pm2 save (ops/README.md, Roll back)"
    fi
  fi
  exit 1
}

# 1. The release must fit this server.
case "$RELEASE" in
  "$RELEASES"/*) ;;
  *) stop "deploy-release.sh must run from a folder in $RELEASES, not $RELEASE" ;;
esac
[ -f "$RELEASE/.release-info" ] && [ -f "$RELEASE/.next/BUILD_ID" ] && [ -x "$RELEASE/node_modules/.bin/next" ] ||
  stop "the release is incomplete (no .release-info, build or node_modules)"
[ -f "$APP_DIR/.env.local" ] || stop "$APP_DIR/.env.local not found"
if [ -e "$CURRENT" ] && [ ! -L "$CURRENT" ]; then stop "$CURRENT exists but is not a link"; fi
build_id=$(cat "$RELEASE/.next/BUILD_ID")

[ "$(node -v)" = "$(info node)" ] ||
  stop "the release was built with Node $(info node), but this server runs $(node -v)"
# NEXT_PUBLIC_* values are built into the code, so they must match the server's settings.
[ "$(info server_url)" = "$(env_value NEXT_PUBLIC_SERVER_URL)" ] ||
  stop "the release was built for a different NEXT_PUBLIC_SERVER_URL than .env.local has"
[ "$(info turnstile_site_key)" = "$(env_value NEXT_PUBLIC_TURNSTILE_SITE_KEY)" ] ||
  stop "the release was built with a different Turnstile site key than .env.local has"
[ "$(info umami_website_id)" = "$(env_value NEXT_PUBLIC_UMAMI_WEBSITE_ID)" ] ||
  stop "the release was built with a different Umami site ID than .env.local has"
site_key_set=$([ -n "$(env_value NEXT_PUBLIC_TURNSTILE_SITE_KEY)" ] && echo yes || echo no)
secret_set=$([ -n "$(env_value TURNSTILE_SECRET_KEY)" ] && echo yes || echo no)
[ "$site_key_set" = "$secret_set" ] ||
  stop "only one of the two Turnstile keys is set in .env.local; set both or neither"
(cd "$RELEASE" && node -e 'require("sharp"); require("libsql")') >/dev/null 2>&1 ||
  stop "the release's native modules (sharp, libsql) do not load with this server's Node"

# 2. Shared files. The release's own data/ and public/media give way to the links.
mkdir -p "$APP_DIR/data" "$APP_DIR/public/media"
rm -rf "${RELEASE:?}/data" "${RELEASE:?}/public/media" "${RELEASE:?}/.env.local"
ln -s "$APP_DIR/.env.local" "$RELEASE/.env.local"
ln -s "$APP_DIR/data" "$RELEASE/data"
ln -s "$APP_DIR/public/media" "$RELEASE/public/media"

# 3. Back up, then migrate. The old release keeps serving during both.
bash "$RELEASE/ops/backup.sh" pre-deploy || stop "the pre-deploy backup failed"
export PRE_DEPLOY_BACKUP_DONE=yes # install-umami.sh needs no second one for a first install (#948)
echo "→ Running database migrations..."
(cd "$RELEASE" && NODE_OPTIONS=--no-deprecation node_modules/.bin/payload migrate) ||
  stop "the database migrations failed (the pre-deploy backup has the data from before)"

# 4. Pages prerendered in CI came from an empty database.
drop_page_cache "$RELEASE"

# 5. Switch and reload.
if [ -L "$CURRENT" ]; then
  previous=$(readlink "$CURRENT")
else
  legacy_args=$(pm2_stored args)
  legacy_cwd=$(pm2_stored cwd)
  [ -n "$legacy_cwd" ] || legacy_cwd="$APP_DIR"
  legacy_config=$(pm2_config_with "${legacy_args:-start}" "$legacy_cwd")
fi
point_current_at "releases/$name"
switched=yes

restart_status=0
EXPECT_BUILD_ID="$build_id" bash "$RELEASE/ops/restart-app.sh" || restart_status=$?
[ "$restart_status" -eq 0 ] || switch_back "the app did not start on release $name"

# 6. The site must answer with this release's build.
if ! wait_until_up "$UP_SECONDS" "$build_id"; then
  if site_is_up && [ -n "$(site_build_id)" ]; then
    # Up, but on another build: PM2 kept the old folder. Start it fresh once.
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 start "$RELEASE/ecosystem.config.cjs" --only "$APP_NAME" >/dev/null
    pm2 save --force >/dev/null
  fi
  wait_until_up "$UP_SECONDS" "$build_id" || switch_back "release $name did not answer through Caddy with its build within ${UP_SECONDS}s"
fi
trap - ERR
[ -z "$legacy_config" ] || rm -f "$legacy_config"
set +e # from here on, a failure is reported but never touches the live release
report "release $name is live (build $build_id)"

# 7. Housekeeping. Each script reports its own result; a failure turns the deploy red.
failed=0
bash "$RELEASE/ops/install-cron.sh" || failed=1
bash "$RELEASE/ops/caddy-limits.sh" || failed=1
bash "$RELEASE/ops/caddy-https.sh" || failed=1
# After the Caddy scripts: its block imports the HSTS file caddy-https.sh writes. A missing
# secret or DNS name is a notice, not a failure.
UMAMI_ADMIN_PASSWORD="$umami_admin_password" bash "$RELEASE/ops/install-umami.sh" || failed=1

keep="$KEEP_RELEASES"
[ "$keep" -ge 2 ] 2>/dev/null || keep=2
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -name '.incoming-*' -exec rm -rf {} +
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %f\n' | sort -rn |
  tail -n +"$((keep + 1))" | while read -r _ old; do
  [ "releases/$old" = "releases/$name" ] || [ "releases/$old" = "$previous" ] || rm -rf "${RELEASES:?}/$old"
done
releases_left=$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '.*' | wc -l)

echo "::notice title=Server::disk $(df -h / | awk 'NR == 2 { print $4 " free of " $2 }'), database $(du -h "$APP_DIR/data/payload.db" 2>/dev/null | cut -f1), media $(du -sh "$APP_DIR/public/media" 2>/dev/null | cut -f1), $releases_left releases kept"
exit "$failed"
