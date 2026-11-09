#!/usr/bin/env bash
# Dumps Umami's Postgres database (#948) to $BACKUP_ROOT/umami/umami-<kind>-<UTC time>.sql.gz and
# copies its settings file next to it (umami-<kind>-<UTC time>.env: the two-factor key and
# APP_SECRET, without which a restored dump can't decrypt the stored two-factor secrets). Both are
# readable by root only. Kept: the 7 newest daily and the 5 newest pre-deploy of each.
#
# Usage: bash ops/backup-umami.sh [daily|pre-deploy]
# The daily cron job runs it right after ops/backup.sh (ops/install-cron.sh); ops/install-umami.sh
# runs it before it updates a running Umami. Does nothing, successfully, while Umami is not
# installed. Restore: ops/umami/README.md.
set -euo pipefail
umask 077

here=$(dirname "$0")
. "$here/lib.sh"
. "$here/umami-lib.sh"

KIND="${1:-daily}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/sprecher-east}"

case "$KIND" in
  daily) keep=7 ;;
  pre-deploy) keep=5 ;;
  *)
    echo "usage: $0 [daily|pre-deploy]" >&2
    exit 2
    ;;
esac

[ -f "$UMAMI_DIR/.env" ] || exit 0 # not installed
if ! umami_running db; then
  report "WARNING: Umami's database is not running, so the $KIND dump was skipped"
  exit 0
fi

dir="$BACKUP_ROOT/umami"
mkdir -p "$dir"
chmod 700 "$BACKUP_ROOT" "$dir"
out="$dir/umami-$KIND-$(date -u +%Y-%m-%dT%H%M%SZ)"
# The database name and user come from the container's own settings (ops/umami/compose.yaml).
if ! umami_compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip >"$out.sql.gz.partial" ||
  ! gzip -t "$out.sql.gz.partial"; then
  rm -f "$out.sql.gz.partial"
  report "ERROR: the Umami $KIND database dump failed"
  exit 1
fi
mv "$out.sql.gz.partial" "$out.sql.gz"
cp "$UMAMI_DIR/.env" "$out.env"

find "$dir" -maxdepth 1 -name "umami-$KIND-*.sql.gz" -printf '%f\n' | sort -r | tail -n +"$((keep + 1))" |
  while read -r old; do rm -f "${dir:?}/${old:?}" "${dir:?}/${old%.sql.gz}.env"; done
report "Umami $KIND database dump ok: $(basename "$out.sql.gz") ($(du -h "$out.sql.gz" | cut -f1))"
