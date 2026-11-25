#!/usr/bin/env bash
# Publishes the developer site (#1459): the component showcase and an index page, as static files that
# Caddy serves at dev.sprechereast.com (environment.sh: DEVELOPER_HOST, DEVELOPER_ROOT). The production
# deploy runs it after the release is live, from the release's own ops/. It never fails the deploy: the
# caller ignores its exit status, and everything it prints is a warning, so a problem here is read, never
# a reason to roll production back. It cannot roll production back either: it runs after the switch.
#
# What it does, each step only if the one before succeeded, and the previous developer site (files and
# Caddy block) stays whenever one fails:
#   1. nothing is changed unless Caddy and the previews' import line are there, this release is still the
#      live one, the release holds a built showcase, and production answers through Caddy;
#   2. the folder to serve is assembled in a staging folder and judged by developer-site-check.sh, which
#      refuses anything that is not the showcase and the two pages;
#   3. the staged folder is renamed into $DEVELOPER_ROOT/releases/<release>;
#   4. the Caddy block, made from ops/caddy/developer-site.caddy, is checked by Caddy alone, moved into the
#      previews' folder with one rename (caddy_place_block in lib.sh, also used for each preview), the whole
#      config checked and Caddy reloaded, and production's home page checked after the reload; on any
#      failure the previous block comes back and Caddy is reloaded again;
#   5. `current` is pointed at the new release with one atomic rename;
#   6. the address is asked, through Caddy on this machine, for what a visitor gets: both pages, the
#      noindex header and disallow-all robots.txt, no HSTS, and a 404 for what only the app has. If that
#      fails and there was an earlier developer site, `current` goes back to it.
# It takes the lock every Caddy change takes (caddy-lock-lib.sh). Caddy's own output is never printed.
set -Eeuo pipefail
umask 022
trap '' HUP # a dropped SSH session must not stop the script between a change and its rollback

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/caddy-lock-lib.sh"

OPS_DIR=$(cd "$(dirname "$0")" && pwd)
SHOWCASE_SOURCE="$CODE_DIR/developer-site/showcase" # built by ops/build-showcase.sh, shipped in the release
PAGES_SOURCE="$OPS_DIR/developer-site"
TEMPLATE="$OPS_DIR/caddy/developer-site.caddy"
HEADERS_SOURCE="$OPS_DIR/caddy/preview-headers.caddy"
RELEASES="$DEVELOPER_ROOT/releases"
CURRENT="$DEVELOPER_ROOT/current"
name=$(basename "$CODE_DIR")
ORIGIN="https://$DEVELOPER_HOST"

staging=""
block_temp=""
CADDY_BLOCK_PREVIOUS=""
cleanup() { rm -rf "$staging" "$block_temp" "$CADDY_BLOCK_PREVIOUS"; }
trap cleanup EXIT
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "WARNING: developer-site.sh failed unexpectedly at line $1; production is unaffected, and the previous developer site is served"
}
trap 'on_unexpected_error $LINENO' ERR

skip() { # <reason>: nothing was changed
  report "WARNING: $1, so the developer site was not updated"
  exit 0
}
fail() { # <reason>: something was tried and put back
  report "WARNING: $1; the previous developer site, if any, is still served"
  exit 1
}

! is_preview || skip "a pull request preview never publishes the developer site"
command -v caddy >/dev/null && [ -f "$CADDYFILE" ] || skip "Caddy or $CADDYFILE was not found"
[ -d "$SHOWCASE_SOURCE" ] || skip "release $name has no built showcase (its build failed or was skipped)"
[ -f "$PAGES_SOURCE/index.html" ] && [ -f "$PAGES_SOURCE/404.html" ] && [ -f "$TEMPLATE" ] ||
  skip "the developer site's pages or block template are missing from release $name"
[ "$(readlink "$APP_DIR/current" 2>/dev/null)" = "releases/$name" ] || skip "release $name is not the live release any more"
# Names that go into a path or a Caddy block must hold nothing a block could misread.
[[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || skip "the release name has characters a path should not hold"
[[ "$DEVELOPER_HOST" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || skip "the developer site's host name is not a host name"
for value in "$DEVELOPER_ROOT" "$PREVIEW_HEADERS_FILE"; do
  [[ "$value" =~ ^/[A-Za-z0-9_./-]+$ ]] || skip "a file path has characters a block can't hold"
done

take_caddy_lock || skip "another change to Caddy is running"
caddy_accepts "$CADDYFILE" || skip "the current Caddyfile does not validate in the deploy shell"
caddy_import_present "$PREVIEW_CADDY_DIR/*.caddy" ||
  skip "the Caddyfile does not import $PREVIEW_CADDY_DIR (ops/caddy-previews.sh adds the line)"
cmp -s "$HEADERS_SOURCE" "$PREVIEW_HEADERS_FILE" ||
  skip "the preview headers file on the server is not this release's copy (ops/caddy-previews.sh installs it)"
# Production must answer before anything changes, so a failure afterwards can only mean this change broke it.
wait_until_up "${UP_WAIT:-90}" || skip "the home page did not answer 200 through Caddy ($(site_url), got $(site_status /))"

# --- 2. Assemble and judge the folder to serve. ---
install -d -m 755 "$DEVELOPER_ROOT" "$RELEASES"
staging="$RELEASES/.incoming-$name"
rm -rf "$staging"
mkdir -m 755 "$staging"
cp -r --no-preserve=mode,ownership "$SHOWCASE_SOURCE" "$staging/showcase"
install -m 644 "$PAGES_SOURCE/index.html" "$PAGES_SOURCE/404.html" "$staging/"
if ! verdict=$(bash "$OPS_DIR/developer-site-check.sh" "$staging" 2>&1); then
  report_lines warning "Developer site" <<<"$verdict"
  fail "the folder for the developer site did not pass its check"
fi

# --- 3. The release folder: one rename. ---
previous=$(readlink "$CURRENT" 2>/dev/null || true) # releases/<name>, or empty on the first publish
if [ "$previous" = "releases/$name" ]; then
  rm -rf "$staging" # this release is already the one served
else
  rm -rf "${RELEASES:?}/$name"
  mv -T "$staging" "$RELEASES/$name"
fi
staging=""

# --- 4. The Caddy block. ---
text=$(cat "$TEMPLATE")
text=${text//__DEVELOPER_HOST__/$DEVELOPER_HOST}
text=${text//__DEVELOPER_ROOT__/$CURRENT}
text=${text//__PREVIEW_HEADERS_FILE__/$PREVIEW_HEADERS_FILE}
case "$text" in *__DEVELOPER_* | *__PREVIEW_*) fail "the developer site's block template has a placeholder this script doesn't fill" ;; esac
[ -d "$PREVIEW_CADDY_DIR" ] || install -d -m 755 "$PREVIEW_CADDY_DIR"
first_load=no
[ -f "$DEVELOPER_CADDY_FILE" ] || first_load=yes
# Next to the block, under a name the folder's `*.caddy` import does not match.
block_temp=$(mktemp "$DEVELOPER_CADDY_FILE.XXXXXX")
printf '%s\n' "$text" >"$block_temp"
chmod 644 "$block_temp"
caddy_accepts "$block_temp" || fail "Caddy rejected the developer site's block, so nothing was changed"
if cmp -s "$block_temp" "$DEVELOPER_CADDY_FILE" 2>/dev/null; then
  rm -f "$block_temp"
else
  if ! caddy_place_block "$block_temp" "$DEVELOPER_CADDY_FILE"; then
    case "$CADDY_BLOCK_PROBLEM" in
      rejected) fail "Caddy rejected the config with the developer site's block; the previous block is back" ;;
      *) fail "Caddy would not reload with the developer site's block; the previous block is back" ;;
    esac
  fi
  if ! wait_until_up "${UP_WAIT_AFTER:-20}"; then
    caddy_restore_block "$DEVELOPER_CADDY_FILE" "$CADDY_BLOCK_PREVIOUS"
    fail "the site stopped answering after the developer site's block was added; the previous block is back"
  fi
fi
block_temp=""

# --- 5. Switch the files. ---
point_link_at "$CURRENT" "releases/$name"

# --- 6. What a visitor gets. ---
developer_problem() { # prints the first thing wrong, or nothing
  local status headers robots path
  for path in / /showcase/index.html; do
    status=$(origin_curl "$ORIGIN" "$path" -o /dev/null -w '%{http_code}' || true)
    [ "$status" = 200 ] || { echo "$path answered ${status:-nothing}, not 200"; return; }
  done
  headers=$(origin_curl "$ORIGIN" / -o /dev/null -D - | tr -d '\r' | tr 'A-Z' 'a-z' || true)
  grep -q '^x-robots-tag:.*noindex' <<<"$headers" || { echo "the page does not send noindex"; return; }
  ! grep -q '^strict-transport-security:' <<<"$headers" || { echo "the page sends HSTS"; return; }
  robots=$(origin_curl "$ORIGIN" /robots.txt || true)
  grep -q '^Disallow: /$' <<<"$robots" || { echo "robots.txt does not disallow everything"; return; }
  # What only the app or the server's files have must not be here: Caddy answers 404 for each.
  for path in /api/version /admin /.env.local; do
    status=$(origin_curl "$ORIGIN" "$path" -o /dev/null -w '%{http_code}' || true)
    [ "$status" = 404 ] || { echo "$path answered ${status:-nothing}, not 404"; return; }
  done
}
seconds=$DEVELOPER_UP_SECONDS
[ "$first_load" = no ] || seconds=$DEVELOPER_UP_SECONDS_NEW # Caddy orders the certificate when the block first loads
deadline=$((SECONDS + seconds))
while problem=$(developer_problem) && [ -n "$problem" ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    if [ -n "$previous" ] && [ "$previous" != "releases/$name" ]; then
      point_link_at "$CURRENT" "$previous"
      fail "the developer site did not pass the live check ($problem); it is back on $(basename "$previous")"
    fi
    fail "the developer site did not pass the live check ($problem); there is no earlier version to go back to, and the certificate may still be on its way"
  fi
  sleep 2
done

# --- Keep the newest releases; never the one served or the one before it. ---
keep="$DEVELOPER_KEEP_RELEASES"
[ "$keep" -ge 2 ] 2>/dev/null || keep=2
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -name '.incoming-*' -exec rm -rf {} +
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %f\n' | sort -rn |
  tail -n +"$((keep + 1))" | while read -r _ old; do
  [ "releases/$old" = "releases/$name" ] || [ "releases/$old" = "$previous" ] || rm -rf "${RELEASES:?}/$old"
done

report "Developer site published: $ORIGIN serves release $name, Caddy $(caddy_version)"
