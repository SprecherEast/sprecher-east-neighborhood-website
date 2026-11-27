#!/usr/bin/env bash
# Builds the component showcase (#1459), the Storybook build, into a folder of the release being built, on the
# GitHub Actions runner, from the release's own checkout (ops/build-release.sh runs it before the site's build
# and before the dev dependencies are pruned). The same static build serves two places: the developer site
# (developer-site/storybook, shipped in every production release and published by ops/developer-site.sh at
# /storybook/) and a pull request preview (public/showcase, served by that preview's own app). It goes when
# the native showcase has replaced it (#1541).
#
# Usage: build-showcase.sh <folder, relative to the release> [optional: yes|no]
#   optional=yes  a failed or timed-out build is a warning and leaves nothing at the folder: the release is
#                 built without a showcase. The production deploy uses it, so the showcase can never fail the
#                 production build.
#   optional=no   a failed build fails the build (a pull request preview that asked for its showcase).
# SHOWCASE_SECONDS (default 600) is how long the build may take. The build runs from the current folder.
set -uo pipefail # no -e: every step that decides the result is checked by hand

. "$(dirname "$0")/optional-build-lib.sh"

optional_build Showcase "${1:-}" "${2:-no}" "${SHOWCASE_SECONDS:-600}" storybook-static index.html iframe.html -- \
  npm run storybook:build
