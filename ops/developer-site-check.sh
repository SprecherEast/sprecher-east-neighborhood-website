#!/usr/bin/env bash
# What the developer site may serve (#1459). ops/developer-site.sh runs it as root on the folder it has
# assembled, before Caddy can serve it. The folder holds the index page, the 404 page and the built
# showcase, and nothing else: no link (a link could lead Caddy, which can read what the web server's
# user can, to a file that is not meant to be public), no file with another name elsewhere, nothing that
# is private by name, nothing anyone can write to, nothing over the size cap, and no reference to a
# third-party font host, and the showcase carries the font files (the font is the site's own, served
# from here). It judges the folder by what is in it and trusts
# nothing about how it was made. Prints each problem, never a file's content (the deploy log is public).
#
# Usage: developer-site-check.sh <folder>            Exit 0 when the folder may be served, 1 when not.
#        developer-site-check.sh --source <folder>   The release's own showcase, before it is copied: only the
#                                                    rules about links, which a copy would hide.
set -Eeuo pipefail

# shellcheck source=environment.sh
. "$(dirname "$0")/environment.sh" # DEVELOPER_MAX_BYTES

source_only=no
if [ "${1:-}" = --source ]; then
  source_only=yes
  shift
fi
folder="${1:-}"
problems=0
fail() {
  echo "not served: $*"
  problems=$((problems + 1))
}

if [ -z "$folder" ] || [ ! -d "$folder" ] || [ -L "$folder" ]; then
  echo "not served: the folder to check is missing or is a link"
  exit 1
fi
cd "$folder"

# Each find prints names NUL-terminated; the loop names each one, relative to the folder.
each() { # <message> <find arguments…>
  local message="$1" path
  shift
  while IFS= read -r -d '' path; do fail "$message: ${path#./}"; done < <(find . "$@" -print0)
}

each "a link" -type l
each "not a plain file or folder" ! -type f ! -type d ! -type l
each "a file with another name elsewhere" -type f -links +1
if [ "$source_only" = yes ]; then
  [ "$problems" -eq 0 ] || exit 1
  echo "showcase source checked: no link in it"
  exit 0
fi

while IFS= read -r -d '' entry; do
  case "${entry#./}" in
    index.html | 404.html | style.css | showcase) ;;
    *) fail "unexpected entry at the top: ${entry#./}" ;;
  esac
done < <(find . -mindepth 1 -maxdepth 1 -print0)
for needed in index.html 404.html style.css showcase/index.html showcase/iframe.html; do
  [ -f "$needed" ] || fail "$needed is missing"
done

each "hidden name" -mindepth 1 -name '.*'
# Whatever the case of the name, and the kinds of file a backup, a dump or a key leaves.
each "a file that is never public" -type f \( -iname '*.db' -o -iname '*.db-wal' -o -iname '*.db-shm' \
  -o -iname '*.sqlite' -o -iname '*.sqlite3' -o -iname '*.sqlite-wal' -o -iname '*.sqlite-shm' \
  -o -iname '*.sql' -o -iname '*.sql.gz' -o -iname '*.tar' -o -iname '*.tar.gz' -o -iname '*.tgz' \
  -o -iname '*.zip' -o -iname '*.pem' -o -iname '*.key' -o -iname '*.bak' -o -iname '*.log' -o -iname '*.env' \
  -o -iname 'id_rsa*' -o -iname 'id_ed25519*' -o -iname 'id_ecdsa*' \)
each "writable by anyone" ! -type l -perm -0002

bytes=$(du -sb . | cut -f1)
[ "$bytes" -le "$DEVELOPER_MAX_BYTES" ] || fail "the folder is over the size cap ($bytes bytes, at most $DEVELOPER_MAX_BYTES)"

# Every file is listed that names a host (a file with a stray NUL byte included), whatever its case (-i). grep says 0
# found, 1 none, 2 an error, and an error is a problem too: a folder that could not be read is not shown
# to be clean.
matches=$(mktemp)
trap 'rm -f "$matches"' EXIT
status=0
grep -rilZF -e fonts.googleapis.com -e fonts.gstatic.com . >"$matches" 2>/dev/null || status=$?
[ "$status" -le 1 ] || fail "the folder could not be read to look for font hosts"
while IFS= read -r -d '' path; do fail "names a third-party font host: ${path#./}"; done <"$matches"

# The showcase's build copies the site's own font files in (`.storybook/fonts.css`): none there means it
# fell back to another source, or to no font at all.
find showcase -type f -iname '*.woff2' -print -quit 2>/dev/null | grep -q . || fail "the showcase carries no font file"

[ "$problems" -eq 0 ] || exit 1
echo "developer site folder checked: it holds only the index page, the 404 page and the showcase"
