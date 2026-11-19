#!/usr/bin/env bash
# Restarts the site under PM2 with the settings in ecosystem.config.cjs (#118, #245).
#
# Next listens on 127.0.0.1:3000 only, so visitors reach it through Caddy and nowhere else.
# When the start settings PM2 has stored (arguments and working folder) differ from
# ecosystem.config.cjs, the app is started fresh: the site is checked through Caddy before and
# after, and the previous settings come back if it stops answering. That happens on the first run
# after #118 (arguments) and after #245 (folder: the `current` release link instead of the old
# checkout), or after any later change to them. Otherwise it is a plain reload.
#
# With EXPECT_BUILD_ID set, "answering" after a fresh start also means /api/version reports that
# build, so the previous settings come back if the old code is still the one serving.
set -Eeuo pipefail # -E: the ERR trap below also covers failures inside functions
trap '' HUP # a dropped SSH session must not stop the script between a change and its rollback

. "$(dirname "$0")/lib.sh"

NAME="$APP_NAME"
DEADLINE_SECONDS="${DEADLINE_SECONDS:-90}"
EXPECT_BUILD_ID="${EXPECT_BUILD_ID:-}"
cd "$CODE_DIR"

rollback_config="" # set once the app is about to be restarted with new settings

# Files the old next-sitemap build wrote into public/ (ignored by git, so a pull never removes them).
# Next serves public/ ahead of app/sitemap.ts and app/robots.ts, so they'd hide the real ones (#267)
rm -f public/sitemap.xml public/sitemap-[0-9]*.xml public/robots.txt

# Any unexpected failure still ends with the app running, and says so: reloaded on the new build,
# or, if it was already deleted for a fresh start, started again with the previous settings.
# Each action comes before its report, so a closed output can't stop the recovery.
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0 # let the main script handle it, once
  trap - ERR
  local config="${rollback_config:-ecosystem.config.cjs}"
  if pm2 describe "$NAME" >/dev/null 2>&1; then
    pm2 reload "$NAME" --update-env >/dev/null 2>&1 || true
    report "ERROR: restart-app.sh failed unexpectedly at line $1; reloaded the app as it was"
  elif pm2 start "$config" --only "$NAME" >/dev/null 2>&1; then
    pm2 save --force >/dev/null 2>&1 || true # only now: saving an empty list would lose the app on reboot
    [ -z "$rollback_config" ] || rm -f "$rollback_config"
    report "ERROR: restart-app.sh failed unexpectedly at line $1 while the app was stopped; started it again"
  else
    report "ERROR: restart-app.sh failed at line $1 and could not start the app again; by hand: cd $CODE_DIR && pm2 start $config --only $NAME && pm2 save"
  fi
  exit 1
}
trap 'on_unexpected_error $LINENO' ERR

# One start setting of $NAME (args or cwd), as PM2 stored it or as ecosystem.config.cjs has it.
setting_of() { # stored|wanted args|cwd
  if [ "$1" = stored ]; then
    pm2_stored "$2"
  else
    node -e '
      const app = require(process.argv[1]).apps.find((a) => a.name === process.argv[2])
      const value = app?.[process.argv[3]]
      console.log(Array.isArray(value) ? value.join(" ") : value || "")
    ' "$CODE_DIR/ecosystem.config.cjs" "$NAME" "$2"
  fi
}

reload() { pm2 reload "$NAME" --update-env >/dev/null; }

stored_args=$(setting_of stored args)
stored_cwd=$(setting_of stored cwd)
wanted_args=$(setting_of wanted args)
wanted_cwd=$(setting_of wanted cwd)
stored="'$stored_args' in $stored_cwd"
wanted="'$wanted_args' in $wanted_cwd"

if ! pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 start ecosystem.config.cjs --only "$NAME" >/dev/null
  pm2 save --force >/dev/null
  if wait_until_up "$DEADLINE_SECONDS" "$EXPECT_BUILD_ID"; then
    report "app was not running; started it with $wanted"
  else
    report "WARNING: app was not running; started it with $wanted, but the site does not answer through Caddy"
  fi
  exit 0
fi

if [ "$stored_args" = "$wanted_args" ] && [ "$stored_cwd" = "$wanted_cwd" ]; then
  reload
  report "app reloaded (start settings unchanged: $wanted)"
  exit 0
fi

# Binding to 127.0.0.1 is only safe if Caddy reaches the app through loopback, and if the app's
# own public address (used for absolute links and images) doesn't point at port 3000.
if [[ "$wanted_args" == *"-H 127.0.0.1"* ]]; then
  upstreams=$({ grep -hoE '^[[:space:]]*reverse_proxy[[:space:]]+[^{]*' "$CADDYFILE" 2>/dev/null || true; } |
    tr -s '[:space:]' '\n' | { grep -E ':3000$' || true; } | sort -u | tr '\n' ' ')
  loopback_only=yes
  [ -n "$upstreams" ] || loopback_only=no
  for upstream in $upstreams; do
    case "${upstream#http://}" in
      localhost:3000 | 127.0.0.1:3000 | :3000) ;;
      *) loopback_only=no ;;
    esac
  done
  if [ "$loopback_only" != yes ]; then
    reload
    report "WARNING: Caddy's upstreams for port 3000 (${upstreams:-none found}) are not all loopback, so the start settings were left as they were"
    exit 0
  fi
  if [[ "$(site_url)" == *:3000 ]]; then
    reload
    report "WARNING: NEXT_PUBLIC_SERVER_URL points at port 3000, so the start settings were left as they were"
    exit 0
  fi
fi

# Check the site through Caddy before changing anything. If it already fails, a failure after
# the restart would mean nothing, so leave the settings as they are.
if ! site_is_up; then
  reload
  report "WARNING: the home page did not answer 200 through Caddy ($(site_url), got $(site_status /)) even before the restart, so the start settings were left as they were"
  exit 0
fi

rollback_config=$(pm2_config_with "${stored_args:-start}" "${stored_cwd:-$APP_DIR}")

pm2 delete "$NAME" >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --only "$NAME" >/dev/null

if wait_until_up "$DEADLINE_SECONDS" "$EXPECT_BUILD_ID"; then
  pm2 save --force >/dev/null
  rm -f "$rollback_config"
  report "app restarted with $wanted (was $stored); the site answers through Caddy"
  exit 0
fi

# Roll back before reporting, so a closed output can't stop the rollback halfway.
pm2 delete "$NAME" >/dev/null 2>&1 || true
pm2 start "$rollback_config" --only "$NAME" >/dev/null
pm2 save --force >/dev/null
rm -f "$rollback_config"
report "ERROR: the site did not answer within ${DEADLINE_SECONDS}s after restarting with $wanted; restored $stored"
exit 1
