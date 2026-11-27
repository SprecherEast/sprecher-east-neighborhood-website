#!/usr/bin/env bash
# Opens an off-site backup copy on the owner's own computer (#1332). Never run on the server: the private key
# must stay in the owner's password manager and on his computer only.
#
# Usage: bash offsite-restore.sh <sealed copy, e.g. sprecher-east-2026-01-04T0815Z.tar.gz.cms> <private key .pem> [<folder for the result>]
#
# It writes the plain daily archive (sprecher-east-<time>.tar.gz, holding payload.db, env.local and media/) into
# the folder (default: the current one), refusing to overwrite a file, after checking that the copy is untouched
# (AES-GCM's authentication tag) and that the archive reads as a gzip tar. The archive holds residents' emails and
# the site's secrets: keep it on this computer, and delete it after the restore. The steps that put it back on
# the server are in ops/README.md, "Restore from an off-site copy".
set -euo pipefail

. "$(dirname "$0")/offsite-lib.sh"

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 <sealed copy> <private key .pem> [<folder for the result>]" >&2
  exit 2
fi
sealed="$1"
key="$2"
out_dir="${3:-.}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[ -f "$sealed" ] || fail "no such file: $sealed"
[ -f "$key" ] || fail "no such file: $key"
[ -d "$out_dir" ] || fail "no such folder: $out_dir"
name=$(basename "$sealed")
case "$name" in
  *"$OFFSITE_SUFFIX") ;;
  *) fail "$name is not a sealed copy (its name should end in $OFFSITE_SUFFIX)" ;;
esac
plain="$out_dir/${name%"$OFFSITE_SUFFIX"}"
[ ! -e "$plain" ] || fail "$plain exists already; move it away first"

partial="$plain.partial"
trap 'rm -f "$partial"' EXIT
# The private key may be protected by a passphrase: openssl asks for it here.
offsite_open "$key" "$sealed" "$partial" || fail "could not open the copy: wrong key, or the file was changed or damaged"
case "$plain" in
  *.tar.gz) tar -tzf "$partial" >/dev/null 2>&1 || fail "the copy opened but is not a readable archive" ;;
esac
mv "$partial" "$plain"
echo "Opened: $plain"
