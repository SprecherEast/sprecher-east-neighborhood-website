#!/bin/bash -p
# Writes, or removes, the Caddy site block of ONE pull request preview (#1345). The restricted preview
# account reaches it through one sudo rule that allows only this script with a pull request number
# (ops/install-preview-access.sh), so it runs as root on input from an account that runs unreviewed
# code. It therefore takes exactly one argument, a number, and nothing else from the caller:
#   - the block is built from PREVIEW_ACCESS_DIR's copies of ops/caddy/preview-site.caddy and
#     preview-headers.caddy, which the production deploy installed from main. It never reads a file
#     from a release or from the preview's folder, so a pull request can't drop the noindex header
#     or add a directive to production's Caddy;
#   - the folder, name, port and address come from ops/environment.sh and the number alone;
#   - the block is validated by Caddy before it is moved into the previews folder (so an invalid
#     block never reaches it), moved in with one rename, and the whole config is validated again
#     before the reload; if either the validation or the reload fails, the previous block (or no
#     block) is put back and the reload is run again, so the config Caddy runs never gets worse;
#   - a preview whose folder no longer exists gets its block removed (the wrapper's teardown).
#   - at most PREVIEW_MAX_COUNT blocks exist at once, because each one orders a certificate from a budget
#     production shares; an existing block can still be updated.
# Nothing Caddy prints is shown: the deploy log is public.
#
# It runs as root on a caller's say-so, so before anything else it fixes its own PATH and locale (sudo's
# `secure_path` does it too, and the installer writes that setting, but a script that runs as root must not
# depend on a setting it can't see) and starts in bash's privileged mode (`-p`: no functions or startup
# files from the environment). The shebang is an absolute path for the same reason.
SECURE_PATH=/usr/sbin:/usr/bin:/sbin:/bin
PATH=$SECURE_PATH
export PATH
LC_ALL=C
export LC_ALL
set -Eeuo pipefail
umask 022

here=$(cd "${BASH_SOURCE[0]%/*}" && pwd -P)
# shellcheck source=preview-access-lib.sh
. "$here/preview-access-lib.sh"

# Run as root, this script trusts nothing from its caller's environment. sudo resets it (the rule
# says so); if something put one of these in anyway, stop rather than act on it.
if [ "$(id -u)" = 0 ]; then
  for name in PREVIEW_ROOT PREVIEW_DOMAIN PREVIEW_CADDY_DIR PREVIEW_PORT_MIN PREVIEW_PORT_MAX \
    PREVIEW_MAX_COUNT PREVIEW_ACCESS_DIR PREVIEW_HEADERS_FILE LIMITS_FILE CADDYFILE CADDY_LOCK_FILE \
    CADDY_LOCK_WAIT RELOAD_CADDY CODE_DIR; do
    [ -z "${!name+x}" ] || refuse "the environment sets $name"
  done
fi

[ "$#" -eq 1 ] || refuse "one pull request number is required"
reset_environment "$here"
use_preview "$1" "$here"
# shellcheck source=lib.sh
. "$here/lib.sh"
# shellcheck source=caddy-lock-lib.sh
. "$here/caddy-lock-lib.sh"

HEADERS_COPY="$here/caddy/preview-headers.caddy"
SITE_TEMPLATE="$here/caddy/preview-site.caddy"
BLOCK="$CADDY_SITE_FILE"

[ -d "$PREVIEW_CADDY_DIR" ] || refuse "the previews folder is missing (ops/caddy-previews.sh makes it)"
[ ! -L "$PREVIEW_CADDY_DIR" ] || refuse "the previews folder is a link"
[ -f "$CADDYFILE" ] || refuse "the Caddyfile is missing"

# One change to Caddy at a time, with the production scripts too.
take_caddy_lock || refuse "another change to Caddy is running"

caddy_accepts "$CADDYFILE" || refuse "the current Caddyfile does not validate, so no block was changed"
caddy_import_present "$PREVIEW_CADDY_DIR/*.caddy" || refuse "the Caddyfile does not import the previews folder"

temp=""
previous=""
cleanup() { rm -f "$temp" "$previous"; }
trap cleanup EXIT

# Puts the previous block back (or none), and reloads again so Caddy runs what it ran before.
roll_back() {
  if [ -n "$previous" ] && [ -s "$previous" ]; then mv -f "$previous" "$BLOCK"; else rm -f "$BLOCK"; fi
  $RELOAD_CADDY >/dev/null 2>&1 || report "ERROR: the previous config is back in $PREVIEW_CADDY_DIR, but Caddy would not reload it"
}

if [ -d "$APP_DIR" ] && [ ! -L "$APP_DIR" ]; then
  # Add or update the block.
  [ -f "$SITE_TEMPLATE" ] && [ -f "$HEADERS_COPY" ] || refuse "main's block template is missing"
  if [ ! -f "$BLOCK" ]; then
    count=$(find "$PREVIEW_CADDY_DIR" -maxdepth 1 -name 'pr-*.caddy' | wc -l)
    [ "$count" -lt "$PREVIEW_MAX_COUNT" ] || refuse "there are already as many previews as are allowed"
  fi
  cmp -s "$HEADERS_COPY" "$PREVIEW_HEADERS_FILE" ||
    refuse "the preview headers file on the server is not main's copy (ops/caddy-previews.sh installs it)"
  [ -f "$LIMITS_FILE" ] || refuse "the form limits file is missing (ops/caddy-limits.sh installs it)"
  for value in "$PREVIEW_HEADERS_FILE" "$LIMITS_FILE"; do
    [[ "$value" =~ ^/[A-Za-z0-9_./-]+$ ]] || refuse "a file path has characters a block can't hold"
  done

  text=$(cat "$SITE_TEMPLATE")
  text=${text//__PREVIEW_HOST__/pr-$PREVIEW_NUMBER.$PREVIEW_DOMAIN}
  text=${text//__PREVIEW_PORT__/$APP_PORT}
  text=${text//__PREVIEW_HEADERS_FILE__/$PREVIEW_HEADERS_FILE}
  text=${text//__LIMITS_FILE__/$LIMITS_FILE}
  case "$text" in *__PREVIEW_* | *__LIMITS_*) refuse "the block template has a placeholder this script doesn't fill" ;; esac

  # Next to the block, under a name the folder's `*.caddy` import does not match.
  temp=$(mktemp "$BLOCK.XXXXXX")
  printf '%s\n' "$text" >"$temp"
  chmod 644 "$temp"
  # Validated here, before it is anywhere Caddy reads it.
  caddy_accepts "$temp" || refuse "Caddy rejected the block; nothing was changed"
  if cmp -s "$temp" "$BLOCK" 2>/dev/null; then
    report "preview $PREVIEW_NUMBER's Caddy block is already in place"
    exit 0
  fi
  if [ -f "$BLOCK" ]; then
    previous=$(mktemp "$BLOCK.XXXXXX")
    cp -p "$BLOCK" "$previous"
  fi
  mv -f "$temp" "$BLOCK" # one rename: Caddy sees the old block or the new one, never half
  temp=""
  if ! caddy_accepts "$CADDYFILE"; then
    roll_back
    report "ERROR: Caddy rejected the config with preview $PREVIEW_NUMBER's block; the previous block is back"
    exit 1
  fi
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    roll_back
    report "ERROR: Caddy would not reload with preview $PREVIEW_NUMBER's block; the previous block is back"
    exit 1
  fi
  report "preview $PREVIEW_NUMBER's Caddy block is in place and Caddy reloaded"
else
  # No folder: the preview is gone, so its block goes too.
  [ -f "$BLOCK" ] || {
    report "preview $PREVIEW_NUMBER has no Caddy block"
    exit 0
  }
  previous=$(mktemp "$BLOCK.XXXXXX")
  mv -f "$BLOCK" "$previous"
  if ! caddy_accepts "$CADDYFILE" || ! $RELOAD_CADDY >/dev/null 2>&1; then
    roll_back
    report "ERROR: Caddy would not reload without preview $PREVIEW_NUMBER's block; the block is back"
    exit 1
  fi
  report "preview $PREVIEW_NUMBER's Caddy block is removed and Caddy reloaded"
fi
