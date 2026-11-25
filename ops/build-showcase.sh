#!/usr/bin/env bash
# Builds the component showcase (#1459) into a folder of the release being built, on the GitHub Actions
# runner, from the release's own checkout (ops/build-release.sh runs it after the site's build and before
# the dev dependencies are pruned). The same static build serves two places: the developer site
# (developer-site/showcase, shipped in every production release and published by ops/developer-site.sh) and a
# pull request preview (public/showcase, served by that preview's own app).
#
# Usage: build-showcase.sh <folder, relative to the release> [optional: yes|no]
#   optional=yes  a failed or timed-out build is a warning and leaves nothing at the folder: the release is
#                 built without a showcase. The production deploy uses it, so the showcase can never fail the
#                 production build.
#   optional=no   a failed build fails the build (a pull request preview that asked for its showcase).
# SHOWCASE_SECONDS (default 600) is how long the build may take. The build runs from the current folder.
set -uo pipefail # no -e: every step that decides the result is checked by hand below

dest="${1:-}"
optional="${2:-no}"
built=storybook-static # where `npm run storybook:build` writes

case "$optional" in yes | no) ;; *)
  echo "::error title=Showcase::the second argument is yes or no"
  exit 2
  ;;
esac

# A folder inside the release: no absolute path, no `..`.
case "$dest" in
  "" | /* | .. | ../* | */.. | */../*)
    echo "::error title=Showcase::the folder for the showcase must be a path inside the release"
    exit 2
    ;;
esac

rm -rf "$built"
status=0
timeout -k 10 "${SHOWCASE_SECONDS:-600}" npm run storybook:build || status=$?
# Moving it in is part of the build: a step that fails there is a build that failed, not one that printed "built".
if [ "$status" -eq 0 ] && [ -f "$built/index.html" ] && [ -f "$built/iframe.html" ] &&
  rm -rf "$dest" && mkdir -p "$(dirname "$dest")" && mv "$built" "$dest"; then
  echo "::notice title=Showcase::built into $dest ($(du -sh "$dest" | cut -f1))"
  exit 0
fi

rm -rf "$built" # never leave a half-built showcase to be packed into the release
if [ "$optional" = yes ]; then
  echo "::warning title=Showcase::the showcase did not build (status $status), so this release has none; the release itself is unaffected"
  exit 0
fi
echo "::error title=Showcase::the showcase did not build (status $status)"
exit 1
