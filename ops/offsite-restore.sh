#!/usr/bin/env bash
# Opens an off-site backup copy on the owner's own computer (#1332). Never run on the server: the private key
# must stay in the owner's password manager and on his computer only.
#
# Works with the bash macOS ships (3.2). Needs OpenSSL 3.0 or later (AES-GCM in `openssl cms`). macOS's own `openssl` is LibreSSL and will not do: install
# OpenSSL 3 (`brew install openssl@3`) and name it: OFFSITE_OPENSSL="$(brew --prefix openssl@3)/bin/openssl" bash offsite-restore.sh ...
# Opening needs about three times the copy's size in free memory (OpenSSL does not stream it): ops/offsite-backup.md.
#
# Usage: bash offsite-restore.sh <sealed copy, e.g. sprecher-east-2026-01-04T0815Z.tar.gz.cms> <private key .pem> [<folder for the result>]
#
# It writes the plain daily archive (sprecher-east-<time>.tar.gz, holding payload.db, env.local and media/) into
# the folder (default: the current one), refusing to overwrite a file. What its checks prove, and what they do not:
#   - AES-GCM's authentication tag proves the bytes were not changed after they were sealed. It does not prove WHO sealed
#     them: the certificate is public, so anyone who can write to the Drive folder can make a copy that opens.
#   - So the archive is also checked member by member: only payload.db, env.local and plain files and folders under
#     media/ (no link, device, setuid bit, absolute or parent path, or other name) are accepted, and a copy with
#     anything else is refused and not written.
#   - Compare the copy's SHA-256 with the one the job recorded (the deploy's annotation, or the offsite-sha256 file on the
#     server) BEFORE opening: give it as OFFSITE_EXPECTED_SHA256=<hash>, and a different file is refused unopened.
# The archive holds residents' emails and the site's secrets: keep it on this computer, and delete it after the restore.
# The steps that put it back on the server are in ops/offsite-backup.md, "Restore from an off-site copy".
set -euo pipefail
umask 077 # the opened archive holds residents' emails and the site's secrets: only its owner may read it

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

if problem=$(offsite_openssl_problem); then :; else
  fail "$problem. Install OpenSSL 3 (macOS: brew install openssl@3) and point this script at it: OFFSITE_OPENSSL=\"\$(brew --prefix openssl@3)/bin/openssl\" bash $0 ..."
fi
[ -f "$sealed" ] || fail "no such file: $sealed"
[ -f "$key" ] || fail "no such file: $key"
[ -d "$out_dir" ] || fail "no such folder: $out_dir"
name=$(basename "$sealed")
# Only a copy the job made, by its own name: every one is an archive, and every archive gets the member check below.
if ! [[ "$name" =~ $OFFSITE_ARCHIVE_PATTERN ]]; then
  fail "$name is not a sealed copy the job made (its name should look like sprecher-east-<time>.tar.gz$OFFSITE_SUFFIX)"
fi
plain="$out_dir/${name%"$OFFSITE_SUFFIX"}"
[ ! -e "$plain" ] || fail "$plain exists already; move it away first"
if [ -n "${OFFSITE_EXPECTED_SHA256:-}" ]; then
  got=$("$OFFSITE_OPENSSL" dgst -sha256 -r "$sealed" | cut -d' ' -f1)
  [ "$got" = "$OFFSITE_EXPECTED_SHA256" ] || fail "the copy's SHA-256 is not the one expected (the job recorded another); it was not opened"
fi

partial="$plain.partial"
trap 'rm -f "$partial"' EXIT
# The private key may be protected by a passphrase (openssl asks for it here); the owner's own key is not.
offsite_open "$key" "$sealed" "$partial" || fail "could not open the copy: wrong key, or the file was changed or damaged"
if problem=$(offsite_archive_problem "$partial"); then :; else fail "$problem; nothing was written"; fi
mv "$partial" "$plain"
echo "Opened: $plain"
echo "Checked: not changed since it was sealed, and nothing in it but the database, the environment file and plain files under media/."
if [ -n "${OFFSITE_EXPECTED_SHA256:-}" ]; then
  echo "Checked: its SHA-256 is the one you gave (the job's record)."
else
  echo "Not checked: who sealed it. Compare its SHA-256 with the job's record (OFFSITE_EXPECTED_SHA256) before you restore."
fi
