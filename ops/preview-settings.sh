#!/usr/bin/env bash
# The settings file of one pull request preview (#1344): <preview folder>/.env.local, written at the
# preview's first deploy and kept on every later one, so its secrets stay the same and nobody is
# signed out by a redeploy. Run with PREVIEW_NUMBER set; nothing else is taken from the caller.
#
# A preview runs code nobody has reviewed yet beside production, so it starts with nothing real:
#   - PAYLOAD_SECRET and PREVIEW_SECRET are random and made here for this preview alone, so a
#     production sign-in token is worth nothing on a preview;
#   - the Turnstile keys are Cloudflare's published test keys (ops/environment.sh);
#   - no SMTP_HOST, so email is written to the preview's own log instead of being sent;
#   - no analytics ID, GitHub token or outside sign-in key.
# Production's .env.local is never read. The file is private to its owner (mode 600), written to a
# temp file in the same folder and moved into place, and no value is ever printed: the deploy log
# is public.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

fail() {
  echo "::error title=Server::preview settings: $1"
  exit 1
}

is_preview || fail "PREVIEW_NUMBER names no pull request preview"
case "$ENV_FILE" in
  "${PREVIEW_ROOT%/}"/pr-*/.env.local) ;;
  *) fail "the settings file is not inside a preview folder" ;;
esac

# Every name the file may hold, and no other.
EXPECTED_NAMES="CONTACT_NOTIFY_EMAIL
DATABASE_URI
NEXT_PUBLIC_SERVER_URL
NEXT_PUBLIC_TURNSTILE_SITE_KEY
PAYLOAD_SECRET
PREVIEW_SECRET
TURNSTILE_SECRET_KEY"

random_secret() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }

# Checks a kept file is still what this script would have written, by name and by value where the
# value isn't a secret. It names the setting that is wrong, never its value.
check_kept_file() {
  local names setting
  names=$(sed -n -E 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=.*/\2/p' "$ENV_FILE" | sort -u)
  [ "$names" = "$EXPECTED_NAMES" ] ||
    fail "the kept settings file holds other settings than a preview may have (delete it to start over)"
  for setting in PAYLOAD_SECRET PREVIEW_SECRET; do
    [[ "$(env_value "$setting")" =~ ^[0-9a-f]{64}$ ]] || fail "the kept $setting is not a generated secret"
  done
  [ "$(env_value NEXT_PUBLIC_SERVER_URL)" = "$SITE_URL" ] || fail "the kept settings name another address"
  [ "$(env_value NEXT_PUBLIC_TURNSTILE_SITE_KEY)" = "$PREVIEW_TURNSTILE_SITE_KEY" ] &&
    [ "$(env_value TURNSTILE_SECRET_KEY)" = "$PREVIEW_TURNSTILE_SECRET_KEY" ] ||
    fail "the kept settings hold a Turnstile key that is not the test key"
}

if [ -f "$ENV_FILE" ]; then
  chmod 600 "$ENV_FILE"
  check_kept_file
  report "preview $PREVIEW_NUMBER keeps its settings file"
  exit 0
fi

mkdir -p "$APP_DIR"
tmp=$(umask 077 && mktemp "$APP_DIR/.env.XXXXXX")
trap 'rm -f "$tmp"' EXIT
{
  echo "# Made by ops/preview-settings.sh for pull request preview $PREVIEW_NUMBER. Throwaway: nothing here is real."
  echo "NEXT_PUBLIC_SERVER_URL=$SITE_URL"
  echo "DATABASE_URI=file:./data/payload.db"
  echo "PAYLOAD_SECRET=$(random_secret)"
  echo "PREVIEW_SECRET=$(random_secret)"
  echo "NEXT_PUBLIC_TURNSTILE_SITE_KEY=$PREVIEW_TURNSTILE_SITE_KEY"
  echo "TURNSTILE_SECRET_KEY=$PREVIEW_TURNSTILE_SECRET_KEY"
  echo "CONTACT_NOTIFY_EMAIL=preview@example.com"
} >"$tmp"
chmod 600 "$tmp"
mv "$tmp" "$ENV_FILE"
trap - EXIT
report "preview $PREVIEW_NUMBER has its own settings file (new secrets, Turnstile test keys, no mail, no analytics)"
