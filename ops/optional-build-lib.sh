#!/usr/bin/env bash
# One build that ships inside a release, which a failure may or may not fail (#1459, #1530). Sourced by
# build-showcase.sh (Storybook) and build-developer-pages.sh (the developer pages), which run on the GitHub
# Actions runner from the release's own checkout, before the site's build and before the dev dependencies
# are pruned. No `set -e` here: every step that decides the result is checked by hand.

# optional_build <title> <folder> <yes|no> <seconds> <output folder> <file that must be in it>... -- <command>...
#   title     what the `::warning` and `::error` annotations are titled with
#   folder    where the output goes, a path inside the release: no absolute path, no `..`
#   yes|no    yes: a failed or timed-out build is a warning and leaves nothing at the folder, so the release is
#             built without it (the production deploy uses it: the build can never fail the production release);
#             no: a failed build fails the build (a pull request preview that asked for it)
#   seconds   how long the command may run
# The output folder is cleared first, so output left by an earlier build is never shipped as this one's, and
# on any failure it is removed again, so a half-built folder is never packed into the release.
optional_build() {
  local title="$1" dest="$2" optional="$3" seconds="$4" built="$5"
  shift 5
  local required=()
  while [ "$#" -gt 0 ] && [ "$1" != -- ]; do
    required+=("$1")
    shift
  done
  shift

  case "$optional" in yes | no) ;; *)
    echo "::error title=$title::the second argument is yes or no"
    return 2
    ;;
  esac
  case "$dest" in
    "" | /* | .. | ../* | */.. | */../*)
      echo "::error title=$title::the folder for the ${title,,} must be a path inside the release"
      return 2
      ;;
  esac

  rm -rf "$built"
  local status=0 file ok=yes
  timeout -k 10 "$seconds" "$@" || status=$?
  for file in "${required[@]}"; do [ -f "$built/$file" ] || ok=no; done
  # Moving it in is part of the build: a step that fails there is a build that failed, not one that printed "built".
  if [ "$status" -eq 0 ] && [ "$ok" = yes ] && rm -rf "$dest" && mkdir -p "$(dirname "$dest")" && mv "$built" "$dest"; then
    echo "::notice title=$title::built into $dest ($(du -sh "$dest" | cut -f1))"
    return 0
  fi

  rm -rf "$built"
  if [ "$optional" = yes ]; then
    echo "::warning title=$title::the ${title,,} did not build (status $status), so this release has none; the release itself is unaffected"
    return 0
  fi
  echo "::error title=$title::the ${title,,} did not build (status $status)"
  return 1
}
