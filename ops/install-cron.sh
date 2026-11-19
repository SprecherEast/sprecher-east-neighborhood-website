#!/usr/bin/env bash
# Installs (or refreshes) the daily data backup job (#148). Run by every deploy once the new
# release is live, so the job on the server always matches this file. The job runs the backup
# script of the live release, through the `current` link (#245).
set -euo pipefail

. "$(dirname "$0")/lib.sh"

CRON_FILE="${CRON_FILE:-/etc/cron.d/sprecher-east-backup}"
BACKUP_SCRIPT="$APP_DIR/current/ops/backup.sh"
UMAMI_BACKUP_SCRIPT="$APP_DIR/current/ops/backup-umami.sh" # after the site's own backup; does nothing until Umami is installed (#948)

if [ ! -f "$BACKUP_SCRIPT" ]; then
  report "ERROR: $BACKUP_SCRIPT not found, so the daily backup job was not changed"
  exit 1
fi

# Cron starts with a minimal PATH; give it the directory of the node the deploy uses.
if ! node_bin=$(command -v node); then
  report "ERROR: node not found, so the daily backup job was not installed"
  exit 1
fi
node_dir=$(dirname "$node_bin")

tmp=$(mktemp)
cat >"$tmp" <<EOF
# Daily data backup for the Sprecher East site (#148).
# Managed by ops/install-cron.sh in the website repo; changes here are overwritten on deploy.
SHELL=/bin/bash
PATH=$node_dir:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 8 * * * root bash $BACKUP_SCRIPT daily >> /var/log/sprecher-east-backup.log 2>&1; bash $UMAMI_BACKUP_SCRIPT daily >> /var/log/sprecher-east-backup.log 2>&1
EOF
install -m 644 "$tmp" "$CRON_FILE"
rm -f "$tmp"

latest=$({ find /var/backups/sprecher-east/daily -maxdepth 1 -name 'sprecher-east-*.tar.gz' -printf '%f\n' 2>/dev/null || true; } | sort -r | head -n 1)
report "daily backup job installed (08:15 UTC); latest daily archive: ${latest:-none yet}"
