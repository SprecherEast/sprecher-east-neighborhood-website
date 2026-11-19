#!/usr/bin/env bash
# Builds a release on the GitHub Actions runner, for ops/deploy-release.sh to put live (#245).
# Run from the repo checkout by .github/workflows/deploy.yml, in a job that has no secrets.
#
# The release is built in the folder it will run from on the server (RELEASE_DIR), with the
# server's Node version, so any absolute path the build writes is right at runtime too. It holds
# the committed files, the .next build, production node_modules and .release-info. It never holds
# a secret: the build only sees public values (NEXT_PUBLIC_*) and throwaway placeholders.
#
# Environment: RELEASE_DIR, SHA, NODE_VERSION (the server's `node -v`), NEXT_PUBLIC_SERVER_URL,
# NEXT_PUBLIC_TURNSTILE_SITE_KEY (may be empty), NEXT_PUBLIC_UMAMI_WEBSITE_ID (may be
# empty), TURNSTILE_PAIRED (yes|no), OUT (archive path).
set -euo pipefail

: "${RELEASE_DIR:?}" "${SHA:?}" "${NODE_VERSION:?}" "${NEXT_PUBLIC_SERVER_URL:?}" "${OUT:?}"
TURNSTILE_PAIRED="${TURNSTILE_PAIRED:-no}"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}"
NEXT_PUBLIC_UMAMI_WEBSITE_ID="${NEXT_PUBLIC_UMAMI_WEBSITE_ID:-}"

if [ "$(node -v)" != "$NODE_VERSION" ]; then
  echo "::error title=Build::runner Node $(node -v) is not the server's $NODE_VERSION"
  exit 1
fi

checkout=$(pwd)
sudo mkdir -p "$RELEASE_DIR"
sudo chown "$(id -u):$(id -g)" "$RELEASE_DIR"
git -C "$checkout" archive --format=tar "$SHA" | tar -x -C "$RELEASE_DIR"
cd "$RELEASE_DIR"

export HUSKY=0 # no git hooks in a release
npm ci --no-audit --no-fund

# Build-time settings. The database is a throwaway one with the schema and no content; the
# pages prerendered from it are dropped on the server before the release goes live.
export DATABASE_URI=file:./data/payload.db
PAYLOAD_SECRET="build-only-$(openssl rand -hex 24)"
export PAYLOAD_SECRET
export NEXT_PUBLIC_SERVER_URL NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_UMAMI_WEBSITE_ID
# next.config.js refuses to build with only one Turnstile key. The secret is read at runtime, so
# the build gets a placeholder when the server has both keys, and nothing when it has neither.
if [ "$TURNSTILE_PAIRED" = yes ]; then export TURNSTILE_SECRET_KEY=build-placeholder-not-a-secret; fi

NODE_OPTIONS=--no-deprecation npx --no-install payload migrate
npm run build

npm prune --omit=dev --no-audit --no-fund
rm -rf data/payload.db* .next/cache node_modules/.cache

# The release must load its native modules (sharp, libsql) on this OS and Node.
node -e 'require("sharp"); require("libsql")'
# No path from the runner may end up in the server code: it would not exist on the server.
if grep -rlF "$checkout" .next/server >/dev/null 2>&1 || grep -rlF "/home/runner" .next/server >/dev/null 2>&1; then
  echo "::error title=Build::the server build refers to a path on the runner"
  exit 1
fi

{
  echo "sha=$SHA"
  echo "node=$NODE_VERSION"
  echo "server_url=$NEXT_PUBLIC_SERVER_URL"
  echo "turnstile_site_key=$NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  echo "umami_website_id=$NEXT_PUBLIC_UMAMI_WEBSITE_ID"
  echo "build_id=$(cat .next/BUILD_ID)"
  echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >.release-info

tar -czf "$OUT" -C "$RELEASE_DIR" .
echo "::notice title=Build::release $(basename "$RELEASE_DIR") built with Node $NODE_VERSION: $(du -sh "$RELEASE_DIR" | cut -f1) unpacked, $(du -h "$OUT" | cut -f1) packed"
