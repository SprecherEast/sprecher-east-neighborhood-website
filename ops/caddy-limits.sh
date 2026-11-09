#!/usr/bin/env bash
# Caps the request body on the public form endpoints and the agents' MCP endpoint (#336) at
# Caddy, so an oversized POST is cut off at 256 KB instead of being read in full by Node (#124).
#
# The limit lives in ops/caddy/form-limits.caddy, copied to /etc/caddy. Each Caddy site block
# that proxies to the app gets one line importing it. Nothing else in the Caddyfile changes,
# and the script checks that before saving. Every change is validated first; if Caddy won't
# reload or the site stops answering, the previous files come back. Running it again changes
# nothing. Because every deploy runs it, the import line comes back unless this script is
# removed from the repo.
set -Eeuo pipefail
umask 077
trap '' HUP # a dropped SSH session must not stop the script between a change and its rollback

. "$(dirname "$0")/lib.sh"

# Any other failure still ends with an annotation (once, from the main shell).
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "ERROR: caddy-limits.sh failed unexpectedly at line $1; check /etc/caddy by hand"
}
trap 'on_unexpected_error $LINENO' ERR

LIMITS_FILE="${LIMITS_FILE:-/etc/caddy/sprecher-east-form-limits.caddy}"
APP_PORT="${APP_PORT:-3000}"
SOURCE="$CODE_DIR/ops/caddy/form-limits.caddy"
IMPORT_LINE="import $LIMITS_FILE"

if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then
  report "WARNING: Caddy or $CADDYFILE not found, so no request body limit was added"
  exit 0
fi

# Status code for a POST of the given body (read from stdin) to the form endpoint, through Caddy.
post_status() {
  site_status /api/form-submissions -X POST -H 'Content-Type: application/json' --data-binary @-
}

# Prints the Caddyfile with the import line added to each site block that proxies to the app on
# loopback and doesn't import it yet. Exits 3 if the layout can't be read safely (braces that
# don't balance, or a heredoc, whose text could look like a site block) and 4 if no site block
# proxies to the app.
add_import_lines() {
  awk -v imp="$IMPORT_LINE" -v port="$APP_PORT" '
    function clean(s) { sub(/(^|[[:space:]])#.*$/, "", s); gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
    {
      text[NR] = $0
      s = clean($0)
      if ($0 ~ /<</) bad = 1 # the raw line: clean() can cut a quoted "#" and hide a heredoc
      if (depth == 0 && s ~ /\{$/ && s !~ /^\{/ && s !~ /^&?\(/) { start = NR; proxies = 0; has = 0 }
      if (depth > 0 && start && s ~ ("^reverse_proxy[[:space:]](.*[[:space:]])?(http://)?(localhost|127\\.0\\.0\\.1)?:" port "([[:space:]{]|$)")) proxies = 1
      if (depth > 0 && start && s == imp) has = 1
      t = s; opens = gsub(/\{/, "", t)
      t = s; closes = gsub(/\}/, "", t)
      depth += opens - closes
      if (depth < 0) bad = 1
      if (depth == 0 && start) {
        if (proxies) found++
        if (proxies && !has) add[start] = 1
        start = 0
      }
    }
    END {
      if (bad || depth != 0) exit 3
      if (!found) exit 4
      for (i = 1; i <= NR; i++) {
        print text[i]
        if (i in add) {
          indent = "\t"
          if ((i + 1) in text && match(text[i + 1], /^[[:space:]]+/)) indent = substr(text[i + 1], 1, RLENGTH)
          print indent imp
        }
      }
    }' "$CADDYFILE"
}

if ! caddy_accepts "$CADDYFILE"; then
  report "WARNING: the current Caddyfile does not validate in the deploy shell, so it was left alone"
  exit 0
fi

# The site must answer through Caddy before anything changes, so that a failure afterwards can
# only mean the change broke it. The app may still be starting after the restart step.
if ! wait_until_up 90; then
  report "WARNING: the home page did not answer 200 through Caddy ($(site_url), got $(site_status /)), so the request body limit was not touched"
  exit 0
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
candidate="$CADDYFILE.sprecher-east-new"
original="$CADDYFILE.sprecher-east-orig"
limits_backup=""
# The copy of the previous limit is removed only once it is no longer needed, so an interrupted
# run leaves it next to the live one.
trap 'rm -f "$candidate" "$original"' EXIT

status=0
add_import_lines >"$candidate" || status=$?
case $status in
  0) ;;
  4)
    report "WARNING: no Caddy site block proxies to the app on port $APP_PORT, so no request body limit was added"
    exit 0
    ;;
  *)
    report "WARNING: could not read the Caddyfile's layout safely, so it was left alone"
    exit 0
    ;;
esac

# The new Caddyfile must be the old one plus import lines, nothing else. Compare against a copy
# that ends with a newline, since the rewritten file always does.
sed -e '$a\' "$CADDYFILE" >"$original"
changes=$(diff --unchanged-line-format= --old-line-format='-%L' --new-line-format='+%L' \
  "$original" "$candidate" || true)
removed=$(grep -c '^-' <<<"$changes" || true)
others=$(sed -n 's/^+[[:space:]]*//p' <<<"$changes" | grep -vxF "$IMPORT_LINE" || true)
if [ "$removed" -ne 0 ] || [ -n "$others" ]; then
  report "ERROR: the Caddyfile edit changed more than the import lines; nothing was changed"
  exit 1
fi
added=$(grep -c '^+' <<<"$changes" || true)

limits_changed=no
if ! cmp -s "$SOURCE" "$LIMITS_FILE"; then limits_changed=yes; fi
limit_text="$(sed -n 's/^[[:space:]]*max_size[[:space:]]*//p' "$SOURCE") on the form and MCP endpoints, Caddy $(caddy_version)"

if [ "$added" -eq 0 ] && [ "$limits_changed" = no ]; then
  report "Caddy request body limit already in place: $limit_text"
else
  # Install the limits file so the candidate can be validated, keeping the old one to put back.
  if [ -f "$LIMITS_FILE" ]; then
    limits_backup=$(mktemp "$LIMITS_FILE.previous-XXXXXX")
    cp -p "$LIMITS_FILE" "$limits_backup"
  fi
  install -m 644 "$SOURCE" "$LIMITS_FILE"

  restore_limits() {
    if [ -n "$limits_backup" ]; then
      cp -p "$limits_backup" "$LIMITS_FILE" && rm -f "$limits_backup"
    else
      rm -f "$LIMITS_FILE"
    fi
  }

  if ! caddy_accepts "$candidate"; then
    if restore_limits; then
      report "ERROR: Caddy rejected the request body limit; nothing was changed"
    else
      report "ERROR: Caddy rejected the request body limit, and the previous limit could not be put back (copy: $limits_backup)"
    fi
    exit 1
  fi

  # Only touch the Caddyfile when import lines are added. Keep the backup the manual procedure
  # uses, plus a dated copy that later runs don't overwrite.
  if [ "$added" -gt 0 ]; then
    cp -p "$CADDYFILE" "$CADDYFILE.bak"
    cp -p "$CADDYFILE" "$CADDYFILE.bak-$stamp"
    cp "$candidate" "$CADDYFILE" # cp onto the existing file keeps its owner and mode
  fi

  # Puts the previous Caddyfile and limit back and reloads. On failure, prints what went wrong.
  restore_all() {
    local failed=""
    # cp reads the backup before it truncates the Caddyfile, so an unreadable backup can't empty it.
    if [ "$added" -gt 0 ] && ! cp "$CADDYFILE.bak-$stamp" "$CADDYFILE"; then
      failed="the Caddyfile (backup: $CADDYFILE.bak-$stamp)"
    fi
    if ! restore_limits; then failed="${failed:+$failed and }the limit (copy: $limits_backup)"; fi
    if [ -n "$failed" ]; then
      echo "Could not put back $failed."
      return 1
    fi
    if ! $RELOAD_CADDY >/dev/null 2>&1; then
      echo "The previous files are back, but Caddy would not reload them."
      return 1
    fi
  }

  problem=""
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    problem="Caddy would not reload with the request body limit"
  elif ! wait_until_up 20; then
    problem="the site stopped answering after adding the request body limit"
  fi
  if [ -n "$problem" ]; then
    if detail=$(restore_all); then
      report "ERROR: $problem; the previous Caddy config is back"
    else
      report "ERROR: $problem. $detail"
    fi
    exit 1
  fi
  if [ -n "$limits_backup" ]; then rm -f "$limits_backup"; fi
  if [ "$added" -gt 0 ]; then
    report "Caddy request body limit added ($limit_text): $added site block(s) now import $LIMITS_FILE (backup: $CADDYFILE.bak-$stamp)"
  else
    report "Caddy request body limit updated: $limit_text"
  fi
fi

# Check the limit from outside Caddy: a 1 MB POST should stop at Caddy with 413, and a small one
# should reach the app. "{}" names no form, so the app refuses it and stores nothing.
body=$(mktemp /tmp/sprecher-east-body-XXXXXX)
head -c 1048576 /dev/zero | tr '\0' 'a' >"$body"
big=$(post_status <"$body")
rm -f "$body"
small=$(printf '{}' | post_status)
if [ "$big" = 413 ] && [ "$small" != 413 ] && [ "$small" != 000 ]; then
  report "request body limit works: a 1 MB form POST got 413; a small one reached the app ($small)"
else
  report "WARNING: request body limit check: a 1 MB form POST got $big (expected 413); a small one got $small"
fi
