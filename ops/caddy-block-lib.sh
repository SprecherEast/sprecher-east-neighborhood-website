# shellcheck shell=bash
# Placing one Caddy block file in a folder the Caddyfile imports (#1072, #1459): the preview blocks
# (ops/preview-caddy.sh) and the developer site's (ops/developer-site.sh). Sourced after lib.sh.
#
# Both callers run these inside an `if`, where `set -e` is off, so each step is checked by hand: a step that
# fails must never leave a half-made file in the folder, because every `*.caddy` there is read at the next
# reload and restart, and one bad file stops Caddy for every site.

# Moves a block file into the folder with one rename, after Caddy accepted the file on its own. Then Caddy
# must accept the whole config with it and reload (and, when a number of seconds is given, the site must
# answer again within them). On any failure the previous block (or none) is back, Caddy is reloaded again,
# and this returns 1 with CADDY_BLOCK_PROBLEM set to:
#   backup    the copy of the previous block could not be made whole; nothing was changed
#   move      the rename failed; nothing was changed
#   rejected  Caddy would not take the whole config with the new block
#   reload    Caddy would not reload, or the site did not answer after it
# CADDY_BLOCK_AFTER says what the restore left (see caddy_restore_block). caddy_block_outcome words it, and
# the problem, for the caller's message, so each message is true for each outcome.
# CADDY_BLOCK_PREVIOUS is the whole, checked copy of the previous block, in the same folder under a name the
# import's `*.caddy` does not match (empty when there was no block, no whole copy, or a copy that could not be
# put back and is left in the folder); the caller removes it.
caddy_place_block() { # <temp file, in the same folder, already accepted> <target block file> [seconds the site gets to answer]
  CADDY_BLOCK_PREVIOUS=""
  CADDY_BLOCK_PROBLEM=""
  CADDY_BLOCK_AFTER=""
  local copy=""
  if [ -f "$2" ]; then
    copy=$(mktemp "$2.XXXXXX") # a failed mktemp leaves no name, and the copy below fails
    if ! cp -p "$2" "$copy" || ! cmp -s "$2" "$copy"; then
      rm -f "$copy" # a copy that did not finish is never put back
      CADDY_BLOCK_PROBLEM=backup
      return 1
    fi
    CADDY_BLOCK_PREVIOUS="$copy"
  fi
  if ! mv -f "$1" "$2"; then # one rename: Caddy sees the old block or the new one, never half
    rm -f "$CADDY_BLOCK_PREVIOUS"
    CADDY_BLOCK_PREVIOUS=""
    CADDY_BLOCK_PROBLEM=move
    return 1
  fi
  if ! caddy_accepts "$CADDYFILE"; then
    CADDY_BLOCK_PROBLEM=rejected
  elif [ -n "${3:-}" ]; then
    [ -z "$(caddy_reload_problem "the block" "$3")" ] || CADDY_BLOCK_PROBLEM=reload
  elif ! $RELOAD_CADDY >/dev/null 2>&1; then
    CADDY_BLOCK_PROBLEM=reload
  fi
  [ -z "$CADDY_BLOCK_PROBLEM" ] || {
    # A copy that could not be put back is the only one left: forget it here so no cleanup deletes it.
    caddy_restore_block "$2" "$CADDY_BLOCK_PREVIOUS" || CADDY_BLOCK_PREVIOUS=""
    return 1
  }
}

# Puts the previous block back (or none), and reloads again so Caddy runs what it ran before. Returns 1,
# saying so, when the previous block could not be put back or Caddy would not reload it. Sets
# CADDY_BLOCK_AFTER to what it left:
#   back       the previous block is back and Caddy reloaded
#   reload     the previous block is back, but Caddy would not reload it
#   kept       the previous block could not be put back: its copy stays, named in the report
#   out        there was no previous block: the new one is taken out and Caddy reloaded
#   outreload  the same, but Caddy would not reload
#   stuck      there was no previous block and the new one could not be taken out: it stays
caddy_restore_block() { # <target block file> <whole copy of the previous block, or empty>
  local back=back
  CADDY_BLOCK_AFTER=kept
  if [ -n "$2" ]; then
    mv -f "$2" "$1" || {
      report "ERROR: the previous block could not be put back in $(dirname "$1") (its copy: $2)"
      return 1
    }
  else
    back=out
    rm -f "$1" || {
      CADDY_BLOCK_AFTER=stuck
      report "ERROR: the new block could not be removed from $(dirname "$1")"
      return 1
    }
  fi
  CADDY_BLOCK_AFTER=reload
  [ "$back" = back ] || CADDY_BLOCK_AFTER=outreload
  $RELOAD_CADDY >/dev/null 2>&1 || {
    report "ERROR: the previous config is back in $(dirname "$1"), but Caddy would not reload it"
    return 1
  }
  CADDY_BLOCK_AFTER=$back
}

# What the folder is like after a failed placement or restore, for the end of a message.
caddy_block_outcome() { # <target block file>
  case "${CADDY_BLOCK_PROBLEM:-}:${CADDY_BLOCK_AFTER:-}" in
    backup:* | move:*) echo "nothing was changed" ;;
    *:kept) echo "the previous block could not be put back as it was; a copy stays in the folder, named above" ;;
    *:stuck) echo "the new block could not be taken out and stays as $1" ;;
    *:out) echo "the new block is taken out" ;;
    *:outreload) echo "the new block is taken out, but Caddy would not reload it" ;;
    *:reload) echo "the previous block is back, but Caddy would not reload it" ;;
    *) echo "the previous block is back" ;;
  esac
}
