#!/usr/bin/env bash
# What the developer site may serve (#1459, #1530). ops/developer-site.sh runs it as root on the folder it
# has assembled, before Caddy can serve it. The folder holds the developer pages (the static export of the
# `developer/` project: its pages and `_next/`) and, until #1541, the Storybook showcase in `storybook/`, and
# nothing else: no link (a link could lead Caddy, which can read what the web server's user can, to a file
# that is not meant to be public), no file with another name elsewhere, nothing that is private by name,
# nothing anyone can write to, nothing over the size cap, and no reference to a third-party font host, and
# the pages and the showcase carry each of the site's own font files (the font is served from here). It
# judges the folder by what is in it and trusts nothing about how it was made. Prints each problem, never a
# file's content (the deploy log is public).
#
# Usage: developer-site-check.sh <folder>            Exit 0 when the folder may be served, 1 when not.
#        developer-site-check.sh --source <folder>   One of the release's own folders (the pages or the
#                                                    showcase), before it is copied: only the rules about
#                                                    links, which a copy would hide.
set -Eeuo pipefail

# shellcheck source=environment.sh
. "$(dirname "$0")/environment.sh" # DEVELOPER_MAX_BYTES

source_only=no
if [ "${1:-}" = --source ]; then
  source_only=yes
  shift
fi
folder="${1:-}"
release=$(cd "$(dirname "$0")/.." && pwd)
fonts_dir="$release/src/platform/theme/fonts" # the one list of the site's faces
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
  echo "source checked: no link in it"
  exit 0
fi

# The one list of what may sit at the top: the pages Next.js exports (a page is a folder with an
# `index.html`, and `index.txt` and `__next.*.txt` are what its client-side navigation reads), its assets in
# `_next/`, and the Storybook showcase. A new top-level page is added here, on purpose.
while IFS= read -r -d '' entry; do
  case "${entry#./}" in
    index.html | 404.html | index.txt | __next.*.txt | _next | _not-found | 404 | showcase | storybook) ;;
    *) fail "unexpected entry at the top: ${entry#./}" ;;
  esac
done < <(find . -mindepth 1 -maxdepth 1 -print0)
for needed in index.html 404.html showcase/index.html; do
  [ -f "$needed" ] || fail "$needed is missing"
done
[ -d _next/static ] || fail "_next/static is missing"
if [ -e storybook ]; then
  for needed in storybook/index.html storybook/iframe.html; do
    [ -f "$needed" ] || fail "$needed is missing"
  done
fi

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

# The pages and the showcase carry the site's own faces: each file in the theme's font folder, which the
# release holds like the rest of the repository, is in the pages' build as `<face with underscores>-<hash or
# suffix>.woff2` in `_next/static/media/` (Next.js's name for a font it copies: `poppins_latin_400_normal-s.p.
# <hash>.woff2`) and in Storybook's as `<face>-<hash>.woff2` (Vite's name). Storybook puts its own Nunito Sans
# files in every build, so a font file of any name proves nothing: a build without the site's faces fell back
# to another source, or to no font at all.
faces=0
for font in "$fonts_dir"/*.woff2; do
  [ -f "$font" ] || continue
  faces=$((faces + 1))
  face=$(basename "$font" .woff2)
  under=${face//-/_}
  [ -n "$(find _next/static/media -type f -iname "$under[-.]*.woff2" -print -quit 2>/dev/null)" ] ||
    fail "the developer pages are missing the site's font: $face"
  [ ! -e storybook ] || [ -n "$(find storybook -type f -iname "$face-*.woff2" -print -quit 2>/dev/null)" ] ||
    fail "the Storybook showcase is missing the site's font: $face"
done
[ "$faces" -gt 0 ] || fail "the site's font files are not at ${fonts_dir#"$release"/}"

[ "$problems" -eq 0 ] || exit 1
echo "developer site folder checked: it holds only the developer pages and, if there is one, the Storybook showcase"
