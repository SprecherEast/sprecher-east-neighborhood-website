#!/usr/bin/env bash
# Builds the developer pages (#1530), a static export of the `developer/` Next.js project, into a folder of
# the release being built, on the GitHub Actions runner, from the release's own checkout (ops/build-release.sh
# runs it before the dev dependencies are pruned). ops/developer-site.sh publishes the folder at
# dev.sprechereast.com as plain files: the site's own app never serves these pages.
#
# Usage: build-developer-pages.sh <folder, relative to the release> [optional: yes|no]
#   optional=yes  a failed or timed-out build is a warning and leaves nothing at the folder: the release is
#                 built without the pages and the developer site is not updated. The production deploy uses it,
#                 so the pages can never fail the production build.
#   optional=no   a failed build fails the build.
# DEVELOPER_PAGES_SECONDS (default 600) is how long the build may take. The build runs from the current folder.
set -uo pipefail # no -e: every step that decides the result is checked by hand

. "$(dirname "$0")/optional-build-lib.sh"

optional_build "Developer pages" "${1:-}" "${2:-no}" "${DEVELOPER_PAGES_SECONDS:-600}" developer/out index.html 404.html showcase/index.html -- \
  npm run developer:build
rc=$?
rm -rf developer/.next # the build's cache is not part of the release
exit "$rc"
