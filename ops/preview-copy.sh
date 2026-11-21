#!/bin/bash -p
# Copies production's published content into ONE pull request preview (#1397, part of #1077). The restricted
# preview account reaches it through one sudo rule that allows only this script with a pull request number
# (ops/install-preview-access.sh), exactly as it reaches ops/preview-caddy.sh, so it runs as root on input
# from an account that runs unreviewed code. It takes one argument, a number, and nothing else from the caller.
#
#   1. Under the lock every Caddy-changing script shares (one at a time, with production's own scripts), it
#      makes a snapshot of production's database with ops/backup-db.mjs, from production's current release,
#      into a new folder inside a root-only one (PREVIEW_COPY_TMP). The snapshot and everything made from it
#      is deleted when the script ends, on success and on every failure, by a trap; a run that was killed
#      leaves a folder that the next run removes first. The preview account can't read that folder
#      (ops/preview-isolation-check.sh proves it).
#   2. It runs the export, `e2e/previewCopyExport.ts`, with `payload run` from production's current release
#      (main's code, never the pull request's), on the snapshot, with a minimal environment (a throwaway secret,
#      an empty SMTP_HOST) and from the run's own folder, which holds no settings file: `payload run` loads
#      settings files from its working folder and the folders above it, and this one sits under a root-only
#      folder in /var/lib, so none of production's settings reaches the export. The
#      scripts and the TypeScript settings still come from the release (absolute path, TSX_TSCONFIG_PATH). It
#      ends after PREVIEW_COPY_SECONDS, so the lock is never held for long. The snapshot is deleted as soon as the
#      export ends.
#   3. For each media file the export lists (the original and each size), it makes a hard link, or a copy when
#      a link would be unsafe, inside the preview's staging folder (`<preview folder>/.copy-media`, made empty
#      by the wrapper). A hard link keeps production's owner and mode, so the preview can read the file and
#      can't change it in place, and deleting it removes only the preview's link (ops/previews.md, "Media").
#      A file is linked only when it is root's, readable by all and writable by no one else, and a regular
#      file; anything else is copied, counted against the disk floor.
#   4. It prints the export's file, and only that, on standard output. The wrapper redirects it into the
#      preview's folder as the preview account. Everything else this script says goes to standard error:
#      numbers and fixed texts, never a name, a path or a byte of the snapshot, because the deploy log is
#      public.
#
# The preview account owns its folder and can rename anything in it while this runs, so root never follows a
# path in it: the staging folder is opened once, checked by what the open file IS (its real path, its type and
# its owner, read from /proc/self/fd), made root's while it is filled, and every name is made inside that
# open folder. A link or a swapped folder is refused, never followed. Nothing is written anywhere else.
#
# It runs as root on a caller's say-so, so before anything else it fixes its own PATH and locale (sudo's
# `secure_path` does it too, and the installer writes that setting) and starts in bash's privileged mode (`-p`:
# no functions or startup files from the environment). The shebang is an absolute path for the same reason.
SECURE_PATH=/usr/sbin:/usr/bin:/sbin:/bin
PATH=$SECURE_PATH
export PATH
LC_ALL=C
export LC_ALL
set -Eeuo pipefail
umask 077

# Standard output is the export's file and nothing else: until the end, everything printed goes to standard error.
exec 3>&1 1>&2

here=$(cd "${BASH_SOURCE[0]%/*}" && pwd -P)
# shellcheck source=preview-access-lib.sh
. "$here/preview-access-lib.sh"
# shellcheck source=secret-lib.sh
. "$here/secret-lib.sh"

# Run as root, this script trusts nothing from its caller's environment.
refuse_environment_as_root PREVIEW_ROOT PREVIEW_DOMAIN PREVIEW_CADDY_DIR PREVIEW_PORT_MIN PREVIEW_PORT_MAX \
  PREVIEW_MAX_COUNT PREVIEW_ACCESS_DIR PREVIEW_USER PREVIEW_FREE_FLOOR_KB PREVIEW_COPY_TMP \
  PREVIEW_COPY_MAX_BYTES PREVIEW_COPY_SECONDS PREVIEW_ACCESS_ROOT_UID PRODUCTION_DIR_FOR_TESTS CADDYFILE CADDY_LOCK_FILE \
  CADDY_LOCK_WAIT CODE_DIR APP_DIR

[ "$#" -eq 1 ] || refuse "one pull request number is required"
reset_environment "$here"
use_preview "$1" "$here"
# shellcheck source=lib.sh
. "$here/lib.sh"
# shellcheck source=caddy-lock-lib.sh
. "$here/caddy-lock-lib.sh"

production="${PRODUCTION_DIR_FOR_TESTS:-$PRODUCTION_DIR}"
# Only a plain letter, digit, dot, bracket, plus, comma, at, equals, tilde, space or dash is linked (and never
# first), so a name can't read as an option, a path or a control character.
NAME_PATTERN='^[A-Za-z0-9][A-Za-z0-9._()+,@=~ -]{0,254}$'
MAX_FILES=20000

note() { echo "::notice title=Preview copy::$*"; }
fail() { # <fixed reason>
  echo "::error title=Preview copy::$1"
  exit 1
}

for value in "$PREVIEW_COPY_TMP" "$production" "$PREVIEW_ROOT"; do
  [[ "$value" =~ ^/[A-Za-z0-9_./-]+$ ]] || fail "a folder path has characters this step does not accept"
done
[ -d "$APP_DIR" ] && [ ! -L "$APP_DIR" ] || fail "the preview has no folder"

# ---- What must be in place, before anything is made. ----

node=""
tools=""
if [ -f "$here/../tools-path" ]; then
  IFS= read -r tools <"$here/../tools-path" || true
  [[ "$tools" =~ ^/[A-Za-z0-9_./:@+-]*$ ]] || fail "the tools path file is not valid"
fi
node=$(trusted_node "$tools") || fail "node was not found where only root can write"
node_dir=${node%/*}

[ -d "$PREVIEW_COPY_TMP" ] && [ ! -L "$PREVIEW_COPY_TMP" ] || fail "the snapshot folder is missing (the installer makes it)"
[ "$(stat -c '%u %a' -- "$PREVIEW_COPY_TMP")" = "$ROOT_UID 700" ] || fail "the snapshot folder is not private to root"

entry=$(getent passwd "$PREVIEW_USER") || fail "the preview account does not exist"
IFS=: read -r _ _ preview_uid preview_gid _ <<<"$entry"
[[ "$preview_uid" =~ ^[1-9][0-9]*$ && "$preview_gid" =~ ^[0-9]+$ ]] || fail "the preview account's ids are not usable"

# Production's current release: main's code. Its export script, its payload command and its backup script.
production_real=$(realpath -m -- "$production")
[ -L "$production/current" ] || fail "production has no current release"
release=$(readlink -f -- "$production/current")
case "$release" in "$production_real/releases/"?*) ;; *) fail "production's current release is not in its releases folder" ;; esac
[ -d "$release" ] && [ -f "$release/e2e/previewCopyExport.ts" ] && [ -f "$release/node_modules/.bin/payload" ] && [ -f "$release/tsconfig.json" ] &&
  [ -f "$release/ops/backup-db.mjs" ] || fail "production's current release does not have the content export"
database="$production/data/payload.db"
[ -f "$database" ] && [ ! -L "$database" ] || fail "production's database was not found"
media_source="$production/public/media"

# One at a time, with production's Caddy scripts and every other preview step.
take_caddy_lock || fail "another change is running"

# ---- The snapshot folder: private, and always removed. ----

work=""
media_fd=""
media_taken=no
media_path=""
cleanup() {
  trap - EXIT
  # A staging folder that was made root's while it was filled goes back to the preview, emptied, so the
  # wrapper can remove it.
  if [ "$media_taken" = yes ] && [ -n "$media_path" ]; then
    find "$media_path/" -mindepth 1 -delete 2>/dev/null || true
    chown "$preview_uid:$preview_gid" "$media_path" 2>/dev/null || true
  fi
  [ -z "$work" ] || rm -rf -- "$work"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

# A run that was killed left its folder here; nothing else runs while this one holds the lock.
find "$PREVIEW_COPY_TMP" -mindepth 1 -maxdepth 1 -name 'run.*' -exec rm -rf -- {} +

db_bytes=$(stat -c %s -- "$database")
# The snapshot and the export's file, which is smaller than the database, on top of production's floor.
enough_disk "$PREVIEW_COPY_TMP" $((2 * db_bytes)) ||
  fail "there is not enough free disk to take the snapshot and keep production's floor"

work=$(mktemp -d "$PREVIEW_COPY_TMP/run.XXXXXX")
mkdir "$work/home" "$work/tmp" "$work/cwd"

"$node" "$release/ops/backup-db.mjs" "$database" "$work/snapshot.db" </dev/null >/dev/null 2>&1 ||
  fail "the snapshot of production's database could not be made"

# ---- The export, from production's release, on the snapshot. ----

secret=$(new_secret) || fail "could not make a throwaway secret"
export_status=0
(
  # A folder with no settings file: `payload run` loads them from its working directory (and its parents), so
  # production's, which the release links to, is never read. The script, its imports and the TypeScript settings
  # are the release's, by absolute path. A run over PREVIEW_COPY_SECONDS ends there, with the lock freed.
  cd "$work/cwd"
  exec timeout -k 10 "$PREVIEW_COPY_SECONDS" env -i PATH="$node_dir:$SECURE_PATH" HOME="$work/home" TMPDIR="$work/tmp" LC_ALL=C \
    NODE_ENV=production NODE_OPTIONS=--no-deprecation DATABASE_URI="file:$work/snapshot.db" \
    PAYLOAD_SECRET="$secret" PREVIEW_COPY_FILE="$work/copy.json" SMTP_HOST= \
    TSX_TSCONFIG_PATH="$release/tsconfig.json" \
    "$node" "$release/node_modules/.bin/payload" run "$release/e2e/previewCopyExport.ts"
) </dev/null >"$work/export.log" 2>&1 || export_status=$?
# Only the export's own lines (numbers, or one fixed sentence): the rest of its output is dropped, since the
# log is public and Payload or the database can put a value in an error.
grep -E '^preview copy: (exported [0-9A-Za-z ,;_-]+|the export failed \(details are not shown: the log is public\))$' "$work/export.log" || true
rm -f -- "$work"/snapshot.db "$work"/snapshot.db-*
[ "$export_status" = 0 ] || fail "the export failed"

copy="$work/copy.json"
[ -f "$copy" ] && [ ! -L "$copy" ] || fail "the export made no file"
[ "$(stat -c %s -- "$copy")" -le "${PREVIEW_COPY_MAX_BYTES:-134217728}" ] || fail "the export's file is bigger than a preview may take"

# The media the export lists, from its own file and checked here: one name per record, NUL-separated.
list_code='
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!data || data.format !== 1 || !Array.isArray(data.mediaFiles)) process.exit(3);
const seen = new Set();
for (const name of data.mediaFiles) {
  if (typeof name !== "string") process.exit(3);
  if (!seen.has(name)) { seen.add(name); process.stdout.write(name + "\0"); }
}'
"$node" -e "$list_code" "$copy" >"$work/names" 2>/dev/null || fail "the export's file is not in the form this step knows"
mapfile -d '' -t names <"$work/names"
[ "${#names[@]}" -le "$MAX_FILES" ] || fail "the export lists more media files than a preview may take"

# ---- The media: links in the staging folder, opened once and checked by what it is. ----

linked=0
copied=0
left_out=0
if [ "${#names[@]}" -gt 0 ]; then
  [ -d "$media_source" ] && [ ! -L "$media_source" ] || fail "production's media folder was not found"
  stage="$COPY_MEDIA_DIR"
  # The trailing `/.` asks for a folder: a pipe or a file put there would otherwise block this open (with the
  # lock held), and now fails at once.
  { exec {media_fd}<"$stage/."; } 2>/dev/null || fail "the preview's staging folder for media is missing"
  media_path="/proc/self/fd/$media_fd"
  # What was opened, not what the name points at now: the real path (a link or a folder swapped in for it
  # shows another path), its type, and that it is the preview account's.
  [ "$(readlink "$media_path")" = "$stage" ] || fail "the preview's staging folder for media is not where it should be"
  [ "$(stat -L -c '%F %u' "$media_path")" = "directory $preview_uid" ] ||
    fail "the preview's staging folder for media is not the preview account's folder"
  # Root's while it is filled: from here the preview account can add nothing to it.
  chown "$ROOT_UID" "$media_path"
  chmod 755 "$media_path"
  media_taken=yes
  [ -z "$(find "$media_path/" -mindepth 1 -print -quit)" ] || fail "the preview's staging folder for media is not empty"
  for name in "${names[@]}"; do
    source_file="$media_source/$name"
    if [[ ! "$name" =~ $NAME_PATTERN ]] || [ ! -f "$source_file" ] || [ -L "$source_file" ]; then
      left_out=$((left_out + 1))
      continue
    fi
    read -r mode size <<<"$(stat -c '%a %s' -- "$source_file")"
    # A link keeps production's owner and mode: so only a file the preview can read and no one but root can write.
    if root_only_writable "$source_file" && (((8#$mode & 8#004) != 0)) &&
      ln -- "$source_file" "$media_path/$name" 2>/dev/null; then
      linked=$((linked + 1))
      continue
    fi
    enough_disk "$media_path/" "$size" ||
      fail "there is not enough free disk to copy the media and keep production's floor"
    cp -- "$source_file" "$media_path/$name"
    chmod 644 "$media_path/$name"
    copied=$((copied + 1))
  done
  # Back to the preview account, the files in it still root's: readable, not writable, removable.
  chown "$preview_uid:$preview_gid" "$media_path"
  chmod 750 "$media_path"
  media_taken=no
fi
note "preview $PREVIEW_NUMBER: $linked media files linked, $copied copied, $left_out left out"

# The one thing on standard output.
cat -- "$copy" >&3
