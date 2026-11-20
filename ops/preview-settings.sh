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
# is public. A link at the preview's folder or file is refused before anything is read or changed.
set -euo pipefail
here=$(dirname "${BASH_SOURCE[0]}")
. "$here/lib.sh"
. "$here/secret-lib.sh"

fail() {
  echo "::error title=Server::preview settings: $1"
  exit 1
}

is_preview || fail "PREVIEW_NUMBER names no pull request preview"
[ "$ENV_FILE" = "${PREVIEW_ROOT%/}/pr-$PREVIEW_NUMBER/.env.local" ] ||
  fail "the settings file is not the preview's own"
# A link could lead to production's folder or file, and chmod and mv would follow or replace it.
[ ! -L "$APP_DIR" ] && [ ! -L "$ENV_FILE" ] || fail "the preview's folder or settings file is a link"

# The file, whole, from its two secrets. The same text is written the first time and compared with
# the kept file every time after, so the kept file is exactly this and nothing more: no other
# setting, no changed value, and no line a different env-file parser would read differently.
render_settings() { # <PAYLOAD_SECRET> <PREVIEW_SECRET>
  echo "# Made by ops/preview-settings.sh for pull request preview $PREVIEW_NUMBER. Throwaway: nothing here is real."
  echo "NEXT_PUBLIC_SERVER_URL=$SITE_URL"
  echo "DATABASE_URI=file:./data/payload.db"
  echo "PAYLOAD_SECRET=$1"
  echo "PREVIEW_SECRET=$2"
  echo "NEXT_PUBLIC_TURNSTILE_SITE_KEY=$PREVIEW_TURNSTILE_SITE_KEY"
  echo "TURNSTILE_SECRET_KEY=$PREVIEW_TURNSTILE_SECRET_KEY"
  echo "CONTACT_NOTIFY_EMAIL=preview@example.com"
}

# The kept file's secret <name>: set on exactly one line, and a generated secret.
kept_secret() {
  local lines
  lines=$(grep -E "^$1=" "$ENV_FILE" || true)
  [ "$(printf '%s' "$lines" | grep -c '')" = 1 ] && is_secret "${lines#*=}" && printf '%s' "${lines#*=}"
}

if [ -f "$ENV_FILE" ]; then
  payload=$(kept_secret PAYLOAD_SECRET) && preview=$(kept_secret PREVIEW_SECRET) ||
    fail "the kept settings file's secrets are missing, repeated or not generated ones (delete the file to start over)"
  render_settings "$payload" "$preview" | cmp -s - "$ENV_FILE" ||
    fail "the kept settings file is not what this script writes (delete the file to start over)"
  # Only a file that passed the check is changed: a refused file (even a hard link) keeps its mode.
  chmod 600 "$ENV_FILE"
  report "preview $PREVIEW_NUMBER keeps its settings file"
  exit 0
fi

payload=$(new_secret) && preview=$(new_secret) ||
  fail "could not generate the secrets (openssl failed); nothing was written"
mkdir -p "$APP_DIR"
tmp=$(umask 077 && mktemp "$APP_DIR/.env.XXXXXX")
trap 'rm -f "$tmp"' EXIT
render_settings "$payload" "$preview" >"$tmp"
chmod 600 "$tmp"
mv "$tmp" "$ENV_FILE"
trap - EXIT
report "preview $PREVIEW_NUMBER has its own settings file (new secrets, Turnstile test keys, no mail, no analytics)"
