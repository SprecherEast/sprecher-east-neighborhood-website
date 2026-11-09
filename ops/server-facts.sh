# shellcheck shell=bash
# Prints what the deploy needs to know about the server before it builds (#245), as key=value
# lines. Not run from a file on the server: the deploy workflow sends ops/lib.sh followed by this
# script to `bash -s` over SSH, so it always runs the version being deployed.
#
# Only public values: the Node version, the NEXT_PUBLIC_* settings that are built into the
# browser code anyway, whether the Turnstile secret is set (never its value), the commit that is
# live, and the free disk space.
set -euo pipefail

deployed=""
if [ -f "$APP_DIR/current/.release-info" ]; then
  deployed=$(sed -n 's/^sha=//p' "$APP_DIR/current/.release-info" | tail -n 1)
elif [ -d "$APP_DIR/.git" ]; then
  deployed=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || true) # the old checkout
fi

echo "node=$(node -v)"
echo "server_url=$(env_value NEXT_PUBLIC_SERVER_URL)"
echo "turnstile_site_key=$(env_value NEXT_PUBLIC_TURNSTILE_SITE_KEY)"
echo "umami_website_id=$(env_value NEXT_PUBLIC_UMAMI_WEBSITE_ID)"
echo "turnstile_secret=$([ -n "$(env_value TURNSTILE_SECRET_KEY)" ] && echo yes || echo no)"
echo "deployed=$deployed"
echo "free_kb=$(df -Pk "$APP_DIR" | awk 'NR == 2 { print $4 }')"
