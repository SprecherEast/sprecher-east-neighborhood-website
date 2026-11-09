# shellcheck shell=bash
# Umami's public address in Caddy (#948), sourced by install-umami.sh after lib.sh and umami-lib.sh.
# The address is served from one file, $UMAMI_CADDY_FILE, that the Caddyfile imports with a single
# line. That file holds the proxy (ops/caddy/umami.caddy) or, while Umami might be running with its
# default admin password, a closed block that answers 503 (ops/caddy/umami-closed.caddy).
# Needs $UMAMI_HOST. Messages never include file contents.

import_line() { echo "import $UMAMI_CADDY_FILE"; }
umami_route_imported() { grep -qxF "$(import_line)" "$CADDYFILE" 2>/dev/null; }

put_back() { # <saved copy or empty>: the route file as it was
  if [ -n "$1" ]; then mv -f "$1" "$UMAMI_CADDY_FILE"; else rm -f "$UMAMI_CADDY_FILE"; fi
}

# Puts a template's block in the route file, validated before Caddy reloads, and (when asked) adds
# the import line to the Caddyfile (backed up first). Returns 0 (done, or nothing to change),
# 3 (no Caddy or Caddyfile), 4 (Caddy did not accept it or a file could not be written; nothing
# changed) or 5 (Caddy would not reload; put back as it was).
set_route() { # <template in ops/caddy> <yes|no: add the import line>
  local template="$CODE_DIR/ops/caddy/$1" add_import="$2" stamp new old="" candidate="" changed=no
  if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then return 3; fi
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  new=$(mktemp "$UMAMI_CADDY_FILE.XXXXXX")
  # set -e does not apply here (the callers test the result), so each step that matters is checked.
  if ! { sed -e "s|__UMAMI_HOST__|$UMAMI_HOST|" -e "s|__UMAMI_PORT__|$UMAMI_PORT|" -e "s|__HSTS_FILE__|$HSTS_FILE|" "$template" >"$new" && chmod 644 "$new"; }; then
    rm -f "$new"
    return 4
  fi
  if [ -f "$UMAMI_CADDY_FILE" ]; then
    old=$(mktemp "$UMAMI_CADDY_FILE.XXXXXX")
    if ! cp -p "$UMAMI_CADDY_FILE" "$old"; then
      rm -f "$new" "$old"
      return 4
    fi
  fi
  cmp -s "$new" "$UMAMI_CADDY_FILE" 2>/dev/null || changed=yes
  if ! mv -f "$new" "$UMAMI_CADDY_FILE"; then
    rm -f "$new" "$old"
    return 4
  fi
  if [ "$add_import" = yes ] && ! umami_route_imported; then
    changed=yes
    candidate=$(mktemp "$CADDYFILE.XXXXXX")
    { cat "$CADDYFILE"; printf '\n# Umami analytics (ops/install-umami.sh, #948)\n%s\n' "$(import_line)"; } >"$candidate"
    # mktemp makes it root-only; Caddy runs as its own user and must keep reading the Caddyfile
    chmod --reference="$CADDYFILE" "$candidate" || changed=failed
    chown --reference="$CADDYFILE" "$candidate" 2>/dev/null || true
  fi
  if [ "$changed" = no ]; then
    rm -f "$old"
    return 0
  fi
  if [ "$changed" = failed ] || ! caddy_accepts "${candidate:-$CADDYFILE}"; then
    put_back "$old"
    [ -z "$candidate" ] || rm -f "$candidate"
    return 4
  fi
  if [ -n "$candidate" ]; then
    # The import line goes in only with a backup to come back to, and never without the route file.
    if ! cp -p "$CADDYFILE" "$CADDYFILE.bak-umami-$stamp" || ! mv -f "$candidate" "$CADDYFILE"; then
      put_back "$old"
      rm -f "$candidate"
      return 4
    fi
  fi
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    if [ -n "$candidate" ] && ! cp -p "$CADDYFILE.bak-umami-$stamp" "$CADDYFILE"; then
      rm -f "$old" # the import line is still there: the route file must stay so it resolves
      return 5
    fi
    put_back "$old"
    $RELOAD_CADDY >/dev/null 2>&1 || true
    return 5
  fi
  rm -f "$old"
}

# Closes the public address if the Caddyfile imports it: a closed block takes the proxy's place.
# Nothing to do (and nothing public) when the import line was never added. 0 when closed or
# nothing to close, 1 when it could not be closed.
close_route() {
  umami_route_imported || return 0
  set_route umami-closed.caddy no
}

# Puts the proxy in place and imports it. Warns, and returns 1, when it can't.
open_route() {
  local status=0
  if [ ! -f "$HSTS_FILE" ]; then
    report "WARNING: $HSTS_FILE not found (ops/caddy-https.sh writes it), so Umami's public address was not opened"
    return 1
  fi
  set_route umami.caddy yes || status=$?
  case "$status" in
    0) return 0 ;;
    3) report "WARNING: Caddy or $CADDYFILE not found, so Umami's public address was not opened" ;;
    4) report "WARNING: the Umami block could not be put in place (Caddy did not accept it, or a file could not be written), so the public address was left as it was" ;;
    *)
      report "ERROR: Caddy would not reload with the Umami block; the Caddy files were put back"
      exit 1
      ;;
  esac
  return 1
}

# Ends the run with an error. Umami might still have its default admin password at this point, so
# the public address is closed first, and the message says if that did not work.
fail_closed() { # <what happened>
  trap - ERR
  if close_route; then
    report "ERROR: $1; Umami stays closed to the public until this is fixed"
  else
    report "ERROR: $1, and its public address could not be closed: remove the import line for $UMAMI_CADDY_FILE from $CADDYFILE by hand and reload Caddy"
  fi
  exit 1
}
