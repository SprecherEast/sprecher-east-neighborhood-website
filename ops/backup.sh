#!/usr/bin/env bash
# Backs up the site's data: database, uploaded media and server settings (#148).
#
# Usage: bash ops/backup.sh [daily|pre-deploy|manual]
#   daily       run by cron (/etc/cron.d/sprecher-east-backup); on Sundays also kept as weekly
#   pre-deploy  run by the deploy workflow before database migrations
#   manual      run by hand before anything risky; never deleted automatically
#
# Archives go to $BACKUP_ROOT/<kind>/sprecher-east-<UTC time>.tar.gz, readable by root only.
# Each holds payload.db, env.local and media/. Restore steps: ops/README.md.
set -euo pipefail

. "$(dirname "$0")/lib.sh"

KIND="${1:-daily}"
SPARE_KB=$((1024 * 1024)) # keep at least 1 GB free after the archive is written

case "$KIND" in
  daily | pre-deploy | manual) ;;
  *)
    echo "usage: $0 [daily|pre-deploy|manual]" >&2
    exit 2
    ;;
esac

# The database file, from DATABASE_URI (file:./data/payload.db) relative to the app folder.
db_uri=$(env_value DATABASE_URI)
if [ -n "$db_uri" ] && [ "${db_uri#file:}" = "$db_uri" ]; then
  # Not a local SQLite file. Never print the value: a remote URI can carry a token.
  report "ERROR: DATABASE_URI is not a local file: URI, so the $KIND backup cannot copy the database"
  exit 1
fi
db_path="${db_uri#file:}"
db_path="${db_path%%\?*}" # drop URI options such as ?mode=ro
db_path="${db_path:-./data/payload.db}"
case "$db_path" in
  /*) ;;
  *) db_path="$APP_DIR/${db_path#./}" ;;
esac
media_dir="$APP_DIR/public/media"

if [ ! -f "$db_path" ]; then
  report "WARNING: no database at $db_path, so there was nothing to back up ($KIND)"
  exit 0
fi

umask 077
mkdir -p "$BACKUP_ROOT"/{daily,weekly,pre-deploy,manual}
chmod 700 "$BACKUP_ROOT"

# One backup at a time (the daily job and a deploy can overlap).
exec 9>"$BACKUP_ROOT/.lock"
if ! flock -w 600 9; then
  report "ERROR: another backup has been running for 10 minutes; $KIND backup not made"
  exit 1
fi

# Leftovers from a run that was killed: work folders and unfinished archives.
find "$BACKUP_ROOT" -maxdepth 1 -name '.work-*' -exec rm -rf {} +
find "$BACKUP_ROOT" -mindepth 2 -maxdepth 2 -name '*.partial' -delete

# Room for the database copy and the archive (at most about the database plus the media),
# with SPARE_KB left over so the live site never runs out of disk.
db_kb=$(du -sk "$db_path" | cut -f1)
media_kb=0
[ -d "$media_dir" ] && media_kb=$(du -sk "$media_dir" | cut -f1)
need_kb=$((2 * db_kb + media_kb + SPARE_KB))
free_kb=$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 { print $4 }')
if [ "$free_kb" -lt "$need_kb" ]; then
  report "ERROR: $KIND backup needs $((need_kb / 1024)) MB free but only $((free_kb / 1024)) MB is; not backing up"
  exit 1
fi

stamp=$(date -u +%Y-%m-%dT%H%MZ)
work=$(mktemp -d "$BACKUP_ROOT/.work-XXXXXX")
trap 'rm -rf "$work"' EXIT

notes=()
node "$CODE_DIR/ops/backup-db.mjs" "$db_path" "$work/payload.db"
members=(payload.db)
if [ -f "$APP_DIR/.env.local" ]; then
  cp "$APP_DIR/.env.local" "$work/env.local"
  members+=(env.local)
else
  notes+=("no .env.local")
fi

media_args=()
if [ -d "$media_dir" ]; then
  media_args=(-C "$APP_DIR/public" media)
else
  notes+=("no media folder")
fi

# Media goes straight into the archive, so there is no uncompressed copy on disk. GNU tar exits
# 1 when a file changed while it was read (an upload during the backup): keep the archive.
set +e
tar -czf "$work/archive.tar.gz" -C "$work" "${members[@]}" "${media_args[@]}"
tar_status=$?
set -e
if [ "$tar_status" -gt 1 ]; then
  report "ERROR: $KIND backup failed while writing the archive (tar exit $tar_status)"
  exit 1
fi
[ "$tar_status" -eq 0 ] || notes+=("a media file changed during the backup")

archive="$BACKUP_ROOT/$KIND/sprecher-east-$stamp.tar.gz"
mv "$work/archive.tar.gz" "$archive"

# On Sundays, keep the daily archive as a weekly one too (hard link: no extra space).
if [ "$KIND" = daily ] && [ "$(date -u +%u)" = 7 ]; then
  ln -f "$archive" "$BACKUP_ROOT/weekly/$(basename "$archive")"
fi

# Retention: 7 daily, 5 weekly, 5 most recent pre-deploy. Manual archives are kept.
prune() { # <dir> <keep>
  find "$1" -maxdepth 1 -name 'sprecher-east-*.tar.gz' -printf '%f\n' | sort -r |
    tail -n +"$(($2 + 1))" | while read -r old; do rm -f "$1/$old"; done
}
prune "$BACKUP_ROOT/daily" 7
prune "$BACKUP_ROOT/weekly" 5
prune "$BACKUP_ROOT/pre-deploy" 5

size=$(du -h "$archive" | cut -f1)
free_gb=$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 { printf "%.1f", $4 / 1024 / 1024 }')
if [ "${#notes[@]}" -gt 0 ]; then
  report "WARNING: $KIND backup made with gaps ($(IFS=';'; echo "${notes[*]}")): $(basename "$archive") ($size), $free_gb GB free"
else
  report "$KIND backup ok: $(basename "$archive") ($size), $free_gb GB free"
fi
