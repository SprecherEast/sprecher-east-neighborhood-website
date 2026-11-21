#!/usr/bin/env bash
# Puts a release built by GitHub Actions live (#245). The deploy workflow unpacks the build into
# $APP_DIR/releases/<name> and runs this script from there.
#
# Until the switch, nothing the visitors see changes: any failure stops the script and the
# previous release keeps serving. The steps:
#   1. check the release fits this server (Node version, public settings, native modules)
#   2. link the shared .env.local, data/ and public/media into it
#   3. back up the data (ops/backup.sh pre-deploy; not for a preview), then run the database migrations
#      (once more if the database was busy before any migration began, #1147)
#      (a preview also makes its test accounts, one per role with new random passwords, #1075, #1393)
#   4. drop the pages prerendered in CI, whose database was empty: each renders from the live
#      database on its first visit, then is cached as usual
#   5. switch the `current` link atomically and reload the app under PM2 (ops/restart-app.sh)
#   6. check the site answers through Caddy with this release's build; if not, switch back
#   7. refresh the backup job, the Caddy settings (request limits, HTTPS), the preview account and Umami analytics, and keep the newest
#      $KEEP_RELEASES releases (a preview does only the last of these)
#
# It acts on production, or on one pull request preview when PREVIEW_NUMBER is set: the folder, PM2
# process, port, settings, data, media, Caddy block and site address come from ops/environment.sh (#1073).
#
# The first run moves the app from the old checkout in $APP_DIR to `current`; the checkout stays
# untouched as the way back (ops/README.md, "Releases").
set -Eeuo pipefail # -E: the ERR trap below also covers failures inside functions
umask 022
trap '' HUP # a dropped SSH session must not stop the script between the switch and a switch back

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/migrate-lib.sh"

# The workflow sends the Umami admin password on stdin and says so with this flag (#948), so a
# run by hand never waits for input. It goes to ops/install-umami.sh only; never an argument.
umami_admin_password=""
if [ "${1:-}" = --umami-password-stdin ]; then
  IFS= read -r -d '' umami_admin_password || true
fi

RELEASE="$CODE_DIR"
# The scripts this one runs on the release's behalf come from the folder it runs from: the release's
# own ops/ for production, and for a preview deploy the root-owned copy made from main
# (ops/preview-wrapper.sh, #1345), never the pull request's files.
OPS_DIR=$(dirname "$0")
RELEASES="$APP_DIR/releases"
CURRENT="$APP_DIR/current"
UP_SECONDS="${UP_SECONDS:-$(is_preview && echo "$PREVIEW_UP_SECONDS" || echo 90)}" # how long the app may take to answer after a reload
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
  elif is_preview; then
    # A new preview has no old checkout to go back to: take it down, so nothing half-working stays.
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 save --force >/dev/null 2>&1 || true
    rm -f "$CURRENT"
    report "ERROR: $reason; the preview was not put live"
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
if is_preview; then
  # The preview's own throwaway settings (ops/preview-settings.sh, #1344); production's are never touched.
  bash "$OPS_DIR/preview-settings.sh" || stop "the preview's settings are not in order"
fi
[ -f "$ENV_FILE" ] || stop "$ENV_FILE not found"
if is_preview; then
  [ -f "$CADDY_SITE_FILE" ] || stop "the preview's Caddy block $CADDY_SITE_FILE is not in place"
  # A preview already running keeps its port; a new one must find it free.
  pm2 describe "$APP_NAME" >/dev/null 2>&1 || port_is_free "$APP_PORT" ||
    stop "port $APP_PORT is already in use"
fi
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
mkdir -p "$DATA_DIR" "$MEDIA_DIR"
rm -rf "${RELEASE:?}/data" "${RELEASE:?}/public/media" "${RELEASE:?}/.env.local"
ln -s "$ENV_FILE" "$RELEASE/.env.local"
ln -s "$DATA_DIR" "$RELEASE/data"
ln -s "$MEDIA_DIR" "$RELEASE/public/media"

# 3. Back up, then migrate. The old release keeps serving during both.
if ! is_preview; then # a preview's data is a copy of content, nothing to back up
  bash "$RELEASE/ops/backup.sh" pre-deploy || stop "the pre-deploy backup failed"
  export PRE_DEPLOY_BACKUP_DONE=yes # install-umami.sh needs no second one for a first install (#948)
fi
echo "→ Running database migrations..."
run_migrate "$RELEASE" ||
  stop "the database migrations failed$(is_preview || echo " (the pre-deploy backup has the data from before)")"

# 3b. A preview's test accounts (#1075, #1393): one verified account per role, so the first account
# registered on an empty database never becomes the preview's admin (#354) and the owner can sign in as each
# role. The passwords are made here, by this script's own folder (main's copy for a preview), into one private
# file in the preview's folder (ops/preview-accounts.sh), new on every deploy; nothing prints them or puts
# them in an argument or an environment variable, only the file's path. Then the release's own code gives
# each account its password, as the app will run (payload run needs NODE_ENV=production here: left
# unset, Payload pushes its development schema over the migrations), after the migrations and before the
# switch, so a preview that anyone can reach is never reachable with an empty `users` collection.
if is_preview; then
  echo "→ Preparing the preview's test accounts..."
  bash "$OPS_DIR/preview-accounts.sh" || stop "the preview's account passwords could not be made"
  (cd "$RELEASE" && PREVIEW_ACCOUNTS_FILE="$ACCOUNTS_FILE" NODE_ENV=production NODE_OPTIONS=--no-deprecation node_modules/.bin/payload run e2e/previewSeed.ts) ||
    stop "the preview's database could not be prepared"
fi

# 4. Pages prerendered in CI came from an empty database.
drop_page_cache "$RELEASE"

# 5. Switch and reload.
if [ -L "$CURRENT" ]; then
  previous=$(readlink "$CURRENT")
elif ! is_preview; then
  legacy_args=$(pm2_stored args)
  legacy_cwd=$(pm2_stored cwd)
  [ -n "$legacy_cwd" ] || legacy_cwd="$APP_DIR"
  legacy_config=$(pm2_config_with "${legacy_args:-start}" "$legacy_cwd")
fi
point_current_at "releases/$name"
switched=yes

restart_status=0
EXPECT_BUILD_ID="$build_id" bash "$OPS_DIR/restart-app.sh" || restart_status=$?
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
report "release $name is live (build $build_id)${PREVIEW_NUMBER:+, preview $PREVIEW_NUMBER}"

# 7. Housekeeping. Each script reports its own result; a failure turns the deploy red.
failed=0
if ! is_preview; then # these change production's backup job, Caddyfile and analytics
  bash "$RELEASE/ops/install-cron.sh" || failed=1
  bash "$RELEASE/ops/caddy-limits.sh" || failed=1
  bash "$RELEASE/ops/caddy-https.sh" || failed=1
  # Pull request previews: one import line for the preview folder (#1072). Does nothing with no previews.
  bash "$RELEASE/ops/caddy-previews.sh" || failed=1
  # The restricted account, wrapper and sudo rule for preview deploys (#1345). Changes nothing on any doubt.
  bash "$RELEASE/ops/install-preview-access.sh" || failed=1
  # After the Caddy scripts: its block imports the HSTS file caddy-https.sh writes. A missing
  # secret or DNS name is a notice, not a failure.
  UMAMI_ADMIN_PASSWORD="$umami_admin_password" bash "$RELEASE/ops/install-umami.sh" || failed=1
fi

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
