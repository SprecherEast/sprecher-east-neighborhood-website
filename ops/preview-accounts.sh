#!/usr/bin/env bash
# The passwords of one pull request preview's test accounts (#1393, part of #1077): one random password
# per role in PREVIEW_ACCOUNT_ROLES, written on every deploy to <preview folder>/.preview-accounts, a
# private file (mode 600) outside data/ and the release. The preview's seed
# (src/endpoints/seed/preview-database.ts) reads it and gives each account its password, so a redeploy
# rotates every password and the old ones stop working. Run with PREVIEW_NUMBER set; nothing else is
# taken from the caller. It is main's script, never the pull request's: the passwords are made here, not
# by code nobody has reviewed.
#
# The file has one `role=password` line per role. No value is ever printed, put in an argument or an
# environment variable: the deploy log is public, and this script's output says only that they were made.
# Written to a temp file in the same folder and moved into place, so a reader never sees half a file.
# A link at the preview's folder or file is refused before anything is changed.
set -euo pipefail
here=$(dirname "${BASH_SOURCE[0]}")
. "$here/lib.sh"
. "$here/secret-lib.sh"

fail() {
  echo "::error title=Server::preview accounts: $1"
  exit 1
}

is_preview || fail "PREVIEW_NUMBER names no pull request preview"
[ "$ACCOUNTS_FILE" = "${PREVIEW_ROOT%/}/pr-$PREVIEW_NUMBER/.preview-accounts" ] ||
  fail "the accounts file is not the preview's own"
# A link could lead to production's folder or file, and mv would follow or replace it.
[ ! -L "$APP_DIR" ] && [ ! -L "$ACCOUNTS_FILE" ] || fail "the preview's folder or accounts file is a link"
# A folder at the file's name would take the file into itself (a plain `mv`); `mv -T` below refuses that too.
[ ! -d "$ACCOUNTS_FILE" ] || fail "the accounts file's name is taken by a folder"

# Every password first, so a failure writes nothing and the kept file is never half new.
lines=""
for role in $PREVIEW_ACCOUNT_ROLES; do
  password=$(new_secret) || fail "could not generate the passwords (openssl failed); nothing was written"
  lines+="$role=$password"$'\n'
done

mkdir -p "$APP_DIR"
tmp=$(umask 077 && mktemp "$APP_DIR/.accounts.XXXXXX")
trap 'rm -f "$tmp"' EXIT
printf '%s' "$lines" >"$tmp"
chmod 600 "$tmp"
mv -T "$tmp" "$ACCOUNTS_FILE" # -T: never into a folder (or a link to one) that appeared at the name
trap - EXIT
report "preview $PREVIEW_NUMBER has new test account passwords for $PREVIEW_ACCOUNT_ROLES (not shown; in a private file in its folder)"
