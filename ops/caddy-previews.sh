#!/usr/bin/env bash
# Prepares Caddy for pull request previews (#1072): one line in the Caddyfile that imports every
# site block in a folder, and the headers snippet those blocks import. With the folder empty the
# line does nothing (an import glob with no match is not an error:
# https://caddyserver.com/docs/caddyfile/directives/import). Writing one block per preview is the
# preview deploy's job.
#
# Nothing is reloaded before Caddy accepts the new Caddyfile together with a sample preview block
# made from ops/caddy/preview-site.caddy, so a broken snippet is caught here, at every deploy,
# not when the first preview needs it. The Caddyfile only gains the import line, after a dated
# backup. If Caddy won't reload, or the site stops answering, the previous files come back. Running
# it again changes nothing. Every deploy runs it, so the line comes back unless this script is
# removed from the repo.
set -Eeuo pipefail
umask 077
trap '' HUP # a dropped SSH session must not stop the script between a change and its rollback

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/caddy-lock-lib.sh"

on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "ERROR: caddy-previews.sh failed unexpectedly at line $1; check /etc/caddy by hand"
}
trap 'on_unexpected_error $LINENO' ERR

HEADERS_SOURCE="$CODE_DIR/ops/caddy/preview-headers.caddy"
SITE_TEMPLATE="$CODE_DIR/ops/caddy/preview-site.caddy"
IMPORT_TARGET="$PREVIEW_CADDY_DIR/*.caddy"

if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then
  report "WARNING: Caddy or $CADDYFILE not found, so pull request previews were not prepared"
  exit 0
fi

# One change to Caddy at a time, with the preview account's block script too (caddy-lock-lib.sh).
take_caddy_lock || {
  report "WARNING: another change to Caddy is running, so pull request previews were not prepared"
  exit 0
}

if ! caddy_accepts "$CADDYFILE"; then
  report "WARNING: the current Caddyfile does not validate in the deploy shell, so it was left alone"
  exit 0
fi

# A preview block imports the form limits, which caddy-limits.sh installs earlier in the deploy.
if [ ! -f "$LIMITS_FILE" ]; then
  report "WARNING: $LIMITS_FILE not found (ops/caddy-limits.sh installs it), so pull request previews were not prepared"
  exit 0
fi

# The site must answer through Caddy before anything changes, so that a failure afterwards can
# only mean the change broke it.
if ! wait_until_up; then
  report "WARNING: the home page did not answer 200 through Caddy ($(site_url), got $(site_status /)), so pull request previews were not prepared"
  exit 0
fi

add_line=no
caddy_import_present "$IMPORT_TARGET" || add_line=yes
headers_changed=no
cmp -s "$HEADERS_SOURCE" "$PREVIEW_HEADERS_FILE" 2>/dev/null || headers_changed=yes

if [ "$add_line" = no ] && [ "$headers_changed" = no ]; then
  install -d -m 755 "$PREVIEW_CADDY_DIR"
  report "Pull request previews already prepared: $PREVIEW_CADDY_DIR is imported, Caddy $(caddy_version)"
  exit 0
fi

what="the pull request preview headers"
[ "$add_line" = no ] || what="the pull request preview import"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
candidate="$CADDYFILE.sprecher-east-previews-new"
sample="$CADDYFILE.sprecher-east-previews-check"
headers_backup=""
trap 'rm -f "$candidate" "$sample"' EXIT

install -d -m 755 "$PREVIEW_CADDY_DIR"

# The new Caddyfile: the old one, plus the import line and its comment.
if [ "$add_line" = yes ]; then
  caddy_with_import "Pull request previews (ops/caddy-previews.sh, #1072)" "import $IMPORT_TARGET" >"$candidate"
else
  cp "$CADDYFILE" "$candidate"
fi
# What Caddy is asked to validate: that, plus one sample preview block (HTTP only, so no
# certificate is involved), which imports the headers file and the form limits as a real one does.
{
  cat "$candidate"
  printf '\n'
  sed -e 's|__PREVIEW_HOST__|http://preview-check.invalid|' -e 's|__PREVIEW_PORT__|3999|' \
    -e "s|__PREVIEW_HEADERS_FILE__|$PREVIEW_HEADERS_FILE|" -e "s|__LIMITS_FILE__|$LIMITS_FILE|" "$SITE_TEMPLATE"
} >"$sample"

# Install the snippet first, so the validation below sees it; the old one is kept to put back.
caddy_install_file "$HEADERS_SOURCE" "$PREVIEW_HEADERS_FILE"
headers_backup="$CADDY_FILE_BACKUP"
restore_headers() { caddy_restore_file "$PREVIEW_HEADERS_FILE" "$headers_backup"; }
restore_headers_say() { restore_headers || { echo "the headers file (copy: $headers_backup)" && return 1; }; }

if ! caddy_accepts "$sample"; then
  caddy_report_rejected "$what" "headers file" "$PREVIEW_HEADERS_FILE" "$headers_backup"
  exit 1
fi

if [ "$add_line" = yes ]; then
  cp -p "$CADDYFILE" "$CADDYFILE.bak-previews-$stamp"
  cp "$candidate" "$CADDYFILE" # cp onto the existing file keeps its owner and mode
fi

# Puts the previous Caddyfile and headers file back and reloads. On failure, prints what went wrong.
roll_back() { caddy_roll_back "$([ "$add_line" = yes ] && echo "$CADDYFILE.bak-previews-$stamp" || true)" restore_headers_say; }

problem=$(caddy_reload_problem "$what")
if [ -n "$problem" ]; then
  if detail=$(roll_back); then
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
