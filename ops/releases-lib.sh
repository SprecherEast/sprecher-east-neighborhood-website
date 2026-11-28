# shellcheck shell=bash
# The release folders the deploys keep (#245, #1459): switching a link to one, and removing the old ones.
# Sourced after lib.sh by the production deploy, the rollback and the developer site.

# Points a link at a target, atomically: a new link renamed over the old.
point_link_at() { # <link> <target>
  local next="${1%/*}/.${1##*/}-new" # `.current-new` for `current`
  ln -sfn "$2" "$next"
  mv -Tf "$next" "$1"
}

# Points `current` at a target relative to $APP_DIR.
point_current_at() { point_link_at "$APP_DIR/current" "$1"; }

# Removes what an interrupted publish left (`.incoming-*`) and the oldest releases. Keeps at least two, and
# never the release just published or the one served before it.
prune_releases() { # <releases folder> <how many to keep> <name of the release just published> [link target of the one before it, e.g. releases/abc]
  local dir="$1" keep="$2" name="$3" previous="${4:-}" old
  [ "$keep" -ge 2 ] 2>/dev/null || keep=2
  find "$dir" -mindepth 1 -maxdepth 1 -type d -name '.incoming-*' -exec rm -rf {} +
  find "$dir" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %f\n' | sort -rn |
    tail -n +"$((keep + 1))" | while read -r _ old; do
    [ "releases/$old" = "releases/$name" ] || [ "releases/$old" = "$previous" ] || rm -rf "${dir:?}/$old"
  done
}
