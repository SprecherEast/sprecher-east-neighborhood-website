#!/bin/bash
# Proof that the pull request preview account can't reach production (#1346). It runs AS that account:
# the wrapper runs it after every preview deploy (and takes the preview down when it fails), and the
# installer runs it before it writes the preview key's line (ops/install-preview-access.sh). It fails when
# the account can
#   - open a production file: the settings (.env.local), the database, the media, the backups, Umami's
#     files, production's PM2 state and logs, or Caddy's data and certificate storage (it looks at the file
#     itself and at every file below each folder, down to eight levels), or
#   - connect to Caddy's admin endpoint on localhost, over IPv4 or IPv6, which accepts any local process
#     and replaces the whole config.
# It reports every failure, not only the first, and never a file's content: the deploy log is public. A
# path that does not exist can't be read, so it counts as safe. Run by root it fails (root reads
# everything), which is the right answer for a check of what an unprivileged account can do.
PATH=/usr/local/bin:/usr/bin:/bin
export PATH
LC_ALL=C
export LC_ALL
set -uo pipefail

here=$(cd "${BASH_SOURCE[0]%/*}" && pwd -P)
# shellcheck source=preview-access-lib.sh
. "$here/preview-access-lib.sh"
reset_environment "$here"
# shellcheck source=umami-lib.sh
. "$here/umami-lib.sh"

production="${PRODUCTION_DIR_FOR_TESTS:-$PRODUCTION_DIR}" # a test points it at a stand-in tree
files=("$production/.env.local" "$production/data/payload.db" "$UMAMI_DIR/.env")
folders=("$production" "$production/data" "$production/public/media" "$BACKUP_ROOT" "$UMAMI_DIR" "$PRODUCTION_PM2_HOME" "$CADDY_STORAGE_DIR")

failures=0
fail() { # <what the account could do>
  echo "::error title=Preview isolation::$1"
  failures=$((failures + 1))
}

for file in "${files[@]}"; do
  if { : <"$file"; } 2>/dev/null; then fail "the preview account can read $file"; fi
done
for folder in "${folders[@]}"; do
  if [ -n "$(find -H "$folder" -maxdepth 8 -type f -readable -print -quit 2>/dev/null)" ]; then
    fail "the preview account can read files in $folder"
  fi
done
for host in 127.0.0.1 ::1; do
  # A connection that is refused or blocked fails; one that is made counts. The timeout is for a
  # firewall that drops instead of rejecting.
  if timeout "${ISOLATION_CONNECT_SECONDS:-5}" bash -c 'exec 3<>"/dev/tcp/$0/$1"' "$host" "$CADDY_ADMIN_PORT" 2>/dev/null; then
    fail "the preview account can connect to Caddy's admin endpoint ($host port $CADDY_ADMIN_PORT)"
  fi
done

if [ "$failures" != 0 ]; then
  echo "::error title=Preview isolation::the isolation check failed ($failures problems): this preview must not run beside production"
  exit 1
fi
echo "::notice title=Preview isolation::the preview account can't read production's files or reach Caddy's admin endpoint"
