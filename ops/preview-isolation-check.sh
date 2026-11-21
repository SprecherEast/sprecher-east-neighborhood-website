#!/bin/bash
# Proof that the pull request preview account can't reach production (#1346). It runs AS that account:
# the wrapper runs it before a preview deploy starts anything and again after it (and takes the preview
# down when it fails), and the installer runs it before it writes the preview key's line
# (ops/install-preview-access.sh). It fails when the account can
#   - open a production file: the settings (.env.local), the database, the media, the backups, Umami's
#     files, production's PM2 state, its PM2 logs (PRODUCTION_PM2_LOG_DIR), or Caddy's data and certificate
#     storage (it looks at the file itself and at every file below each folder, down to eight levels);
#   - enter a folder ops/preview-host-guards.sh closes (production's, the backups, Umami's, the PM2 logs'),
#     even when it can't list it, because a file in such a folder is found only by its name; for PM2's state
#     and Caddy's storage, which the guards leave alone, this proves only that no file there is readable;
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
closed=("$production" "$BACKUP_ROOT" "$UMAMI_DIR" "$PRODUCTION_PM2_LOG_DIR")
folders=("${closed[@]}" "$production/data" "$production/public/media" "$PRODUCTION_PM2_HOME" "$CADDY_STORAGE_DIR")

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
for folder in "${closed[@]}"; do
  if [ -d "$folder" ] && [ -x "$folder" ]; then fail "the preview account can enter $folder"; fi
done
for host in 127.0.0.1 ::1; do
  # port_is_free (environment.sh) answers 1 when a connection is made, 0 when it is refused. The timeout is
  # for a firewall that drops instead of rejecting (it ends the probe with 124: blocked).
  connected=0
  timeout "${ISOLATION_CONNECT_SECONDS:-5}" bash -c "$(declare -f port_is_free); port_is_free \"\$1\" \"\$2\"" _ "$CADDY_ADMIN_PORT" "$host" 2>/dev/null || connected=$?
  if [ "$connected" = 1 ]; then
    fail "the preview account can connect to Caddy's admin endpoint ($host port $CADDY_ADMIN_PORT)"
  fi
done

if [ "$failures" != 0 ]; then
  echo "::error title=Preview isolation::the isolation check failed ($failures problems): this preview must not run beside production"
  exit 1
fi
echo "::notice title=Preview isolation::Preview isolation: the preview account can't read production's files or reach Caddy's admin endpoint"
