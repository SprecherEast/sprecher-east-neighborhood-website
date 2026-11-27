#!/usr/bin/env bash
# Sends the site's newest daily backup to Google Drive, sealed so the server cannot read it (#1332).
#
# Usage: bash ops/offsite-backup.sh [run|test|check]
#   run    (default; the weekly cron job) seal the newest daily archive, upload it with rclone, check
#          the upload's size and checksum, keep the newest OFFSITE_KEEP copies, write the result
#   test   the same with a tiny made-up file, so a new Drive credential can be tried without a real archive
#          (the installer runs it once for each new credential)
#   check  read-only: is there a copy in Drive no older than OFFSITE_MAX_AGE_DAYS, and did the last run
#          succeed? (run by every deploy, the owner's signal)
# Exit status: 0 done, 1 failed (the message says why), 78 not set up yet (no public key or no credential).
#
# The daily archive (ops/backup.sh) already holds a consistent copy of the database (VACUUM INTO, ops/backup-db.mjs),
# the media and .env.local, so this job seals that file rather than copying the live files again.
# Only the sealed file ever leaves the server, and only ops/offsite-lib.sh seals it (see there). Nothing
# secret is printed: the deploy log and this job's log are not private. The Drive credential is read by
# rclone alone, from a root-only file.
set -Eeuo pipefail

. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/offsite-lib.sh"

MODE="${1:-run}"
case "$MODE" in
  run | test | check) ;;
  *)
    echo "usage: $0 [run|test|check]" >&2
    exit 2
    ;;
esac

OFFSITE_CERT="${OFFSITE_CERT:-$CODE_DIR/ops/offsite-backup-cert.pem}"
RCLONE="${RCLONE:-rclone}"
OFFSITE_STATUS="$BACKUP_ROOT/offsite-status"
SPARE_KB="${OFFSITE_SPARE_KB:-$((1024 * 1024))}" # keep at least 1 GB free beside the sealed copy
umask 077

work=""
cleanup() { [ -z "$work" ] || rm -rf "$work"; }
trap cleanup EXIT

# Records how the last run went, for `check` and for whoever looks. Fixed words only.
write_status() { # <ok|failed> <fixed text>
  [ -d "$BACKUP_ROOT" ] || return 0
  printf 'result=%s\ntime=%s\ndetail=%s\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$2" >"$OFFSITE_STATUS.tmp" &&
    mv -f "$OFFSITE_STATUS.tmp" "$OFFSITE_STATUS" || true
}

# A failure: the message goes to the deploy annotation or the log, and a run (not a check) is recorded.
fail() { # <message>
  report "ERROR: off-site backup: $*"
  [ "$MODE" = check ] || write_status failed "$*"
  exit 1
}
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  fail "stopped unexpectedly at line $1 of offsite-backup.sh"
}
trap 'on_unexpected_error $LINENO' ERR

not_set_up() { # <message>
  report "off-site backup is not set up yet: $*"
  exit 78
}

rc() { "$RCLONE" --config "$OFFSITE_RCLONE_CONF" --retries 3 --low-level-retries 10 --contimeout 60s --timeout 10m "$@"; }

# What must exist before anything is sealed or sent. A missing piece is "not set up", never an upload without it.
problem=$(offsite_cert_problem "$OFFSITE_CERT") || {
  [ ! -f "$OFFSITE_CERT" ] && not_set_up "ops/offsite-backup-cert.pem (the public key) is not in the repository yet"
  fail "$problem"
}
[ -f "$OFFSITE_RCLONE_CONF" ] || not_set_up "the Drive credential (the OFFSITE_BACKUP_RCLONE_CONF secret) has not reached the server yet"
command -v "$RCLONE" >/dev/null 2>&1 || fail "rclone is not installed (the deploy installs it: ops/install-offsite-backup.sh)"

# The copies in Drive whose names match <pattern>, one "<name>;<modification time>" line each, newest name first.
remote_list() { # <pattern>
  rc lsf --files-only --format pt --separator ';' "$OFFSITE_REMOTE" | awk -F';' -v re="$1" '$1 ~ re' | sort -r
}

if [ "$MODE" = check ]; then
  newest=$(remote_list "$OFFSITE_ARCHIVE_PATTERN" | sed -n 1p) || fail "could not list the copies in Drive"
  if [ -z "$newest" ]; then
    # Right after the install the first weekly run has not happened yet.
    cron_age=$(($(date +%s) - $(stat -c %Y "$OFFSITE_CRON_FILE" 2>/dev/null || echo 0)))
    if [ -f "$OFFSITE_CRON_FILE" ] && [ "$cron_age" -lt $((OFFSITE_MAX_AGE_DAYS * 86400)) ]; then
      report "off-site backup is installed; the first weekly copy is not there yet"
      exit 0
    fi
    fail "no copy in Drive"
  fi
  name=${newest%%;*}
  when=${newest#*;}
  age_days=$((($(date +%s) - $(date -d "$when" +%s)) / 86400))
  if [ "$age_days" -gt "$OFFSITE_MAX_AGE_DAYS" ]; then
    fail "the newest copy in Drive ($name) is $age_days days old; the limit is $OFFSITE_MAX_AGE_DAYS"
  fi
  if [ -f "$OFFSITE_STATUS" ] && grep -q '^result=failed$' "$OFFSITE_STATUS"; then
    fail "the last weekly run failed: $(sed -n 's/^detail=//p' "$OFFSITE_STATUS" | head -n 1)"
  fi
  report "off-site backup ok: newest copy $name, $age_days days old"
  exit 0
fi

# One run at a time (a run by hand and the weekly job could overlap).
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
exec 8>"$BACKUP_ROOT/.offsite.lock"
flock -n 8 || {
  report "ERROR: off-site backup: another run is still going; this one did nothing"
  exit 1
}
find "$BACKUP_ROOT" -maxdepth 1 -name '.offsite-work-*' -exec rm -rf {} + # leftovers of a killed run

if [ "$MODE" = test ]; then
  stamp=$(date -u +%Y-%m-%dT%H%MZ)
  name="sprecher-east-test-$stamp.txt$OFFSITE_SUFFIX"
  pattern="$OFFSITE_TEST_PATTERN"
  keep=1
  work=$(mktemp -d "$BACKUP_ROOT/.offsite-work-XXXXXX")
  source_file="$work/test.txt"
  echo "A test file from the Sprecher East server, made $stamp. It holds no site data." >"$source_file"
else
  archive=$({ find "$BACKUP_ROOT/daily" -maxdepth 1 -name 'sprecher-east-*.tar.gz' 2>/dev/null || true; } | sort | tail -n 1)
  [ -n "$archive" ] || fail "there is no daily archive to send yet"
  archive_age_hours=$((($(date +%s) - $(stat -c %Y "$archive")) / 3600))
  [ "$archive_age_hours" -le "$OFFSITE_MAX_ARCHIVE_HOURS" ] ||
    fail "the newest daily archive is $archive_age_hours hours old (the limit is $OFFSITE_MAX_ARCHIVE_HOURS), so the daily backup is not running"
  name="$(basename "$archive")$OFFSITE_SUFFIX"
  [[ "$name" =~ $OFFSITE_ARCHIVE_PATTERN ]] || fail "the daily archive's name is not the expected form"
  pattern="$OFFSITE_ARCHIVE_PATTERN"
  keep="$OFFSITE_KEEP"
  need_kb=$(($(du -sk "$archive" | cut -f1) + SPARE_KB))
  free_kb=$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 { print $4 }')
  [ "$free_kb" -ge "$need_kb" ] || fail "needs $((need_kb / 1024)) MB free for the sealed copy but only $((free_kb / 1024)) MB is"
  work=$(mktemp -d "$BACKUP_ROOT/.offsite-work-XXXXXX")
  source_file="$archive"
fi

# 1. Seal. The sealed file must be new bytes that are not the source (a gzip archive starts 1f 8b), and nothing
#    but this file is ever handed to rclone.
sealed="$work/$name"
offsite_seal "$OFFSITE_CERT" "$source_file" "$sealed" || fail "sealing to the public key failed"
[ -s "$sealed" ] && [ "$(head -c 2 "$sealed" | od -An -tx1 | tr -d ' \n')" != 1f8b ] &&
  [ "$(stat -c %s "$sealed")" -gt "$(stat -c %s "$source_file")" ] ||
  fail "the sealed file did not come out right, so nothing was sent"
[[ "$name" == *"$OFFSITE_SUFFIX" ]] || fail "refusing to send a file that is not sealed"

# 2. Upload, then 3. check the copy in Drive: same size and the same MD5 as the sealed file we hold.
rc copyto "$sealed" "$OFFSITE_REMOTE/$name" || fail "the upload to Drive failed"
local_size=$(stat -c %s "$sealed")
local_md5=$(md5sum "$sealed" | cut -d' ' -f1)
remote=$(rc lsf --files-only --format hsp --hash MD5 --separator ';' "$OFFSITE_REMOTE" | awk -F';' -v n="$name" '$3 == n' | head -n 1) || remote=""
remote_md5=$(cut -d';' -f1 <<<"$remote") # the format "hsp" prints the hash, the size and the name, in that order
remote_size=$(cut -d';' -f2 <<<"$remote")
if [ "$remote_size" != "$local_size" ] || [ -z "$remote_md5" ] || [ "$remote_md5" != "$local_md5" ]; then
  rc deletefile --drive-use-trash=false "$OFFSITE_REMOTE/$name" >/dev/null 2>&1 || true # never leave a copy we could not vouch for
  fail "the copy in Drive does not match what was sent (size or checksum), so it was removed"
fi

# 4. Retention, only after a verified upload: the newest $keep of this kind stay. Only names this job makes
#    can match, so nothing else in the folder is ever deleted.
removed=0
while IFS=';' read -r old _; do
  [ -n "$old" ] || continue
  rc deletefile --drive-use-trash=false "$OFFSITE_REMOTE/$old" || fail "the copy was sent and checked, but removing old copy $old failed"
  removed=$((removed + 1))
done < <(remote_list "$pattern" | tail -n +$((keep + 1)))

write_status ok "sent $name"
size=$(du -h "$sealed" | cut -f1)
if [ "$MODE" = test ]; then
  report "off-site backup test ok: $name ($size) is in Drive, checked, and removed $removed older test file(s)"
else
  report "off-site backup ok: $name ($size) is in Drive, checked; removed $removed old copy(ies), newest $keep kept"
fi
