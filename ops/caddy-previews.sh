#!/usr/bin/env bash
# Prepares Caddy for pull request previews (#1072): one line in the Caddyfile that imports every
# site block in a folder, and the headers snippet those blocks import. With the folder empty the
# line does nothing (an import glob with no match is not an error:
# https://caddyserver.com/docs/caddyfile/directives/import). Writing one block per preview is the
# preview deploy's job.
#
# The Caddyfile only gains the import line, after a dated backup and a `caddy validate`. If Caddy
# won't reload, or the site stops answering, the previous files come back. Running it again
# changes nothing. Every deploy runs it, so the line comes back unless this script is removed.
set -Eeuo pipefail
umask 077
trap '' HUP # a dropped SSH session must not stop the script between a change and its rollback

. "$(dirname "$0")/lib.sh"

on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "ERROR: caddy-previews.sh failed unexpectedly at line $1; check /etc/caddy by hand"
}
trap 'on_unexpected_error $LINENO' ERR

SOURCE="$CODE_DIR/ops/caddy/preview-headers.caddy"
IMPORT_LINE="import $PREVIEW_CADDY_DIR/*.caddy"

if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then
  report "WARNING: Caddy or $CADDYFILE not found, so pull request previews were not prepared"
  exit 0
fi

# True when the Caddyfile has the import line, however it was indented, spaced or commented by hand.
import_present() {
  awk -v want="$PREVIEW_CADDY_DIR/*.caddy" '{ sub(/#.*/, "") } $1 == "import" && $2 == want && NF == 2 { found = 1 } END { exit !found }' "$CADDYFILE"
}

if ! caddy_accepts "$CADDYFILE"; then
  report "WARNING: the current Caddyfile does not validate in the deploy shell, so it was left alone"
  exit 0
fi

# The site must answer through Caddy before anything changes, so that a failure afterwards can
# only mean the change broke it.
if ! wait_until_up "${UP_WAIT:-90}"; then
  report "WARNING: the home page did not answer 200 through Caddy ($(site_url), got $(site_status /)), so pull request previews were not prepared"
  exit 0
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
candidate="$CADDYFILE.sprecher-east-new"
headers_backup=""
trap 'rm -f "$candidate"' EXIT

add_line=no
import_present || add_line=yes
headers_changed=no
cmp -s "$SOURCE" "$PREVIEW_HEADERS_FILE" 2>/dev/null || headers_changed=yes

install -d -m 755 "$PREVIEW_CADDY_DIR"

if [ "$add_line" = no ] && [ "$headers_changed" = no ]; then
  report "Pull request previews already prepared: $PREVIEW_CADDY_DIR is imported, Caddy $(caddy_version)"
  exit 0
fi

# The Caddyfile must end with a newline before the line is added, and gains nothing else.
if [ "$add_line" = yes ]; then
  { sed -e '$a\' "$CADDYFILE" && printf '\n# Pull request previews (ops/caddy-previews.sh, #1072)\n%s\n' "$IMPORT_LINE"; } >"$candidate"
fi

# Install the snippet first so the candidate can be validated with it, keeping the old one.
if [ -f "$PREVIEW_HEADERS_FILE" ]; then
  headers_backup=$(mktemp "$PREVIEW_HEADERS_FILE.previous-XXXXXX")
  cp -p "$PREVIEW_HEADERS_FILE" "$headers_backup"
fi
install -m 644 "$SOURCE" "$PREVIEW_HEADERS_FILE"

restore_headers() {
  if [ -n "$headers_backup" ]; then
    cp -p "$headers_backup" "$PREVIEW_HEADERS_FILE" && rm -f "$headers_backup"
  else
    rm -f "$PREVIEW_HEADERS_FILE"
  fi
}

if [ "$add_line" = yes ] && ! caddy_accepts "$candidate"; then
  if restore_headers; then
    report "ERROR: Caddy rejected the pull request preview import; nothing was changed"
  else
    report "ERROR: Caddy rejected the pull request preview import, and the previous headers file could not be put back (copy: $headers_backup)"
  fi
  exit 1
fi

if [ "$add_line" = yes ]; then
  cp -p "$CADDYFILE" "$CADDYFILE.bak-previews-$stamp"
  cp "$candidate" "$CADDYFILE" # cp onto the existing file keeps its owner and mode
fi

restore_all() {
  local failed=""
  # cp reads the backup before it truncates the Caddyfile, so an unreadable backup can't empty it.
  if [ "$add_line" = yes ] && ! cp "$CADDYFILE.bak-previews-$stamp" "$CADDYFILE"; then
    failed="the Caddyfile (backup: $CADDYFILE.bak-previews-$stamp)"
  fi
  if ! restore_headers; then failed="${failed:+$failed and }the headers file (copy: $headers_backup)"; fi
  if [ -n "$failed" ]; then
    echo "Could not put back $failed."
    return 1
  fi
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    echo "The previous files are back, but Caddy would not reload them."
    return 1
  fi
}

problem=$(caddy_reload_problem "the pull request preview import" "${UP_WAIT_AFTER:-20}")
if [ -n "$problem" ]; then
  if detail=$(restore_all); then
    report "ERROR: $problem; the previous Caddy config is back"
  else
    report "ERROR: $problem. $detail"
  fi
  exit 1
fi
[ -z "$headers_backup" ] || rm -f "$headers_backup"

if [ "$add_line" = yes ]; then
  report "Pull request previews prepared: the Caddyfile now imports $PREVIEW_CADDY_DIR (backup: $CADDYFILE.bak-previews-$stamp), Caddy $(caddy_version)"
else
  report "Pull request preview headers updated, Caddy $(caddy_version)"
fi
