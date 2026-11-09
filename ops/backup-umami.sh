#!/usr/bin/env bash
# Dumps Umami's Postgres database (#948) to $BACKUP_ROOT/umami/umami-<kind>-<UTC time>.sql.gz,
# readable by root only. Kept: the 7 newest daily dumps and the 5 newest pre-deploy ones.
#
# Usage: bash ops/backup-umami.sh [daily|pre-deploy]
# The daily cron job runs it right after ops/backup.sh (ops/install-cron.sh); ops/install-umami.sh
# runs it before it updates a running Umami. Does nothing, successfully, while Umami is not
# installed. Restore: ops/README.md, "Umami".
set -euo pipefail
umask 077

. "$(dirname "$0")/lib.sh"

KIND="${1:-daily}"
UMAMI_DIR="${UMAMI_DIR:-/var/www/umami}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/sprecher-east}"

case "$KIND" in
  daily | pre-deploy) ;;
  *)
    echo "usage: $0 [daily|pre-deploy]" >&2
    exit 2
    ;;
esac

[ -f "$UMAMI_DIR/.env" ] || exit 0 # not installed
compose() { docker compose --project-directory "$UMAMI_DIR" "$@"; }
if [ -z "$({ compose ps --status running -q db 2>/dev/null || true; } | head -n 1)" ]; then
  report "WARNING: Umami's database is not running, so the $KIND dump was skipped"
  exit 0
fi

dir="$BACKUP_ROOT/umami"
mkdir -p "$dir"
chmod 700 "$BACKUP_ROOT" "$dir"
out="$dir/umami-$KIND-$(date -u +%Y-%m-%dT%H%MZ).sql.gz"
# The database name and user come from the container's own settings (ops/umami/compose.yaml).
if ! compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip >"$out.partial" ||
  ! gzip -t "$out.partial"; then
  rm -f "$out.partial"
  report "ERROR: the Umami $KIND database dump failed"
  exit 1
fi
mv "$out.partial" "$out"

keep=7
[ "$KIND" = daily ] || keep=5
find "$dir" -maxdepth 1 -name "umami-$KIND-*.sql.gz" -printf '%f\n' | sort -r |
  tail -n +"$((keep + 1))" | while read -r old; do rm -f "$dir/$old"; done
report "Umami $KIND database dump ok: $(basename "$out") ($(du -h "$out" | cut -f1))"
