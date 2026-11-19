#!/usr/bin/env bash
# Checks the visit counter's site ID the server reports (#950) before the deploy builds with it.
# Empty is fine (nothing is counted); anything else must be a real UUID, the same shape
# src/platform/analytics/umami.ts accepts, so a typo can't pass here and then count nothing.
#
# Environment: UMAMI_ID (may be empty).
set -euo pipefail

UMAMI_ID="${UMAMI_ID:-}"

if [ -n "$UMAMI_ID" ] && ! [[ "$UMAMI_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "::error title=Preflight::NEXT_PUBLIC_UMAMI_WEBSITE_ID in .env.local is not a site ID (a UUID like 123e4567-e89b-12d3-a456-426614174000); fix it or remove the line"
  exit 1
fi
