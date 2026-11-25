#!/usr/bin/env bash
# What the developer site may serve (#1459). ops/developer-site.sh runs it as root on the folder it has
# assembled, before Caddy can serve it. The folder holds the index page, the 404 page and the built
# showcase, and nothing else: no link (a link could lead Caddy, which can read what the web server's
# user can, to a file that is not meant to be public), no file with another name elsewhere, nothing that
# is private by name, nothing anyone can write to, nothing over the size cap, and no reference to a
# third-party font host (the font is served from here). It judges the folder by what is in it and trusts
# nothing about how it was made. Prints each problem, never a file's content (the deploy log is public).
#
# Usage: developer-site-check.sh <folder>      Exit 0 when the folder may be served, 1 when not.
set -Eeuo pipefail

# shellcheck source=environment.sh
. "$(dirname "$0")/environment.sh" # DEVELOPER_MAX_BYTES

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

while IFS= read -r -d '' entry; do
  case "${entry#./}" in
    index.html | 404.html | showcase) ;;
    *) fail "unexpected entry at the top: ${entry#./}" ;;
  esac
done < <(find . -mindepth 1 -maxdepth 1 -print0)
for needed in index.html 404.html showcase/index.html showcase/iframe.html; do
  [ -f "$needed" ] || fail "$needed is missing"
done

each "a link" -type l
each "not a plain file or folder" ! -type f ! -type d ! -type l
each "a file with another name elsewhere" -type f -links +1
each "hidden name" -mindepth 1 -name '.*'
each "a file that is never public" -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \
  -o -name '*.sql' -o -name '*.pem' -o -name '*.key' -o -name '*.bak' -o -name '*.log' -o -name '*.env' \)
each "writable by anyone" ! -type l -perm -0002

bytes=$(du -sb . | cut -f1)
[ "$bytes" -le "$DEVELOPER_MAX_BYTES" ] || fail "the folder is over the size cap ($bytes bytes, at most $DEVELOPER_MAX_BYTES)"

# Text only (-I): a font or an image is never read as text. grep says 0 found, 1 none, 2 an error, and an
# error is a problem too: a folder that could not be read is not shown to be clean.
matches=$(mktemp)
trap 'rm -f "$matches"' EXIT
status=0
grep -rIlZF -e fonts.googleapis.com -e fonts.gstatic.com . >"$matches" 2>/dev/null || status=$?
[ "$status" -le 1 ] || fail "the folder could not be read to look for font hosts"
while IFS= read -r -d '' path; do fail "names a third-party font host: ${path#./}"; done <"$matches"

[ "$problems" -eq 0 ] || exit 1
echo "developer site folder checked: it holds only the index page, the 404 page and the showcase"
