#!/bin/bash
# The only thing the pull request preview deploy key can run (#1345). The key's line in
# authorized_keys is `restrict,command="<this file>" <key>`, so whatever the client asks for arrives
# here as SSH_ORIGINAL_COMMAND, and a shell, a port forward or any other command never starts.
# The production deploy installs this file, root-owned, from main (ops/install-preview-access.sh);
# a preview deploy never writes it. It runs as the unprivileged preview account.
#
# Actions (one line, words separated by single spaces):
#   facts                      public facts about the server, for the build (Node version, free disk)
#   list                       the previews that exist, each with the commit that is live
#   upload <number> <commit>   a release archive (.tar.gz) on stdin, unpacked into the preview's folder
#   deploy <number> <commit>   puts that uploaded release live (Caddy block, then ops/deploy-release.sh)
#   teardown <number>          stops the preview, deletes its folder and its Caddy block
#
# Every word is checked against a fixed pattern before anything uses it, and no word is ever passed to
# a shell or `eval`: the number and the commit become one path component and one argument each, after
# they match ^[1-9][0-9]{0,5}$ and ^[0-9a-f]{40}$ (ops/environment.sh). A refused request prints a
# fixed text, never the request. The Caddy block is written by ops/preview-caddy.sh through one narrow
# sudo rule; this script never touches Caddy's files.
# The tools it runs come from fixed folders, never from the caller's PATH (and an absolute shebang): the
# folders the installer found for node and pm2 (a root-owned file), then the system's.
PATH=/usr/local/bin:/usr/bin:/bin
export PATH
LC_ALL=C
export LC_ALL
set -euo pipefail
umask 027

here=$(cd "${BASH_SOURCE[0]%/*}" && pwd -P)
# shellcheck source=preview-access-lib.sh
. "$here/preview-access-lib.sh"
reset_environment "$here"

if [ -f "$here/../tools-path" ]; then
  IFS= read -r tools_path <"$here/../tools-path" || true
  [[ "$tools_path" =~ ^/[A-Za-z0-9_./:@+-]*$ ]] || refuse "the tools path file is not valid"
  PATH="$tools_path:$PATH"
fi

request="${SSH_ORIGINAL_COMMAND-}"
[ -n "$request" ] || refuse "only the preview actions are allowed (no shell)"
# Lowercase letters, then at most two words of lowercase hex and digits, single spaces, nothing else:
# a newline, quote, `$`, `;`, `-`, `.` or `/` fails here.
[[ "$request" =~ ^[a-z]+(\ [0-9a-f]+){0,2}$ ]] || refuse "the request is not one of the preview actions"
read -r action number commit <<<"$request"

case "$action" in
  facts | list) [ -z "$number" ] || refuse "$action takes no argument" ;;
  upload | deploy) valid_commit "$commit" || refuse "not a commit" ;; # the number is checked by use_preview
  teardown)
    [ -n "$number" ] || refuse "teardown needs a number"
    [ -z "$commit" ] || refuse "teardown takes only a number"
    ;;
  *) refuse "not a preview action" ;;
esac

# The environment of this preview (any number checks the root and the domain for facts and list).
use_preview "${number:-1}" "$here"
[ -z "$number" ] || [ ! -L "$APP_DIR" ] || refuse "the preview's folder is a link"

# What the scripts below need, from the account's own folder: PM2 and the tools keep their state
# there, because the account's home is root-owned and not writable.
mkdir -p "$PREVIEW_ROOT"
export PM2_HOME="${PM2_HOME:-$PREVIEW_ROOT/.pm2}"
export HOME="$PREVIEW_ROOT/.home"
mkdir -p "$HOME"
sudo_caddy() { # <number>
  sudo -n "$PREVIEW_ACCESS_DIR/ops/preview-caddy.sh" "$1"
}
# Stops the preview and deletes its folder and Caddy block. APP_DIR is <preview root>/pr-<number>, from the
# number alone (environment.sh), and was checked above not to be a link. A caller that adds `|| true` runs
# every step even after one failed (`set -e` is off inside a function called that way).
take_down() {
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  pm2 save --force >/dev/null 2>&1 || true
  rm -rf -- "${APP_DIR:?}"
  sudo_caddy "$number"
}

case "$action" in
  facts)
    echo "node=$(node -v)"
    echo "account=$(id -un)"
    echo "free_kb=$(df -Pk "$PREVIEW_ROOT" | awk 'NR == 2 { print $4 }')"
    ;;

  list)
    for folder in "$PREVIEW_ROOT"/pr-*; do
      [ -d "$folder" ] && [ ! -L "$folder" ] || continue
      id=${folder##*/pr-}
      valid_preview_number "$id" || continue
      live=$(readlink "$folder/current" 2>/dev/null || true)
      live=${live#releases/}
      valid_commit "$live" || live=none
      echo "preview=$id commit=$live"
    done
    ;;

  upload)
    if [ ! -d "$APP_DIR" ]; then # a new preview: not beyond the allowed number
      count=$(find "$PREVIEW_ROOT" -maxdepth 1 -type d -name 'pr-*' | wc -l)
      [ "$count" -lt "$PREVIEW_MAX_COUNT" ] || refuse "there are already as many previews as are allowed"
    fi
    [ ! -L "$APP_DIR/releases" ] || refuse "releases is a link"
    mkdir -p "$APP_DIR/releases"
    [ "$(readlink "$APP_DIR/current" 2>/dev/null || true)" != "releases/$commit" ] ||
      refuse "that release is live; not replacing it"
    archive="$APP_DIR/releases/.incoming-$commit.tar.gz"
    incoming="$APP_DIR/releases/.incoming-$commit"
    trap 'rm -rf "$archive" "$incoming"' EXIT
    rm -rf "$archive" "$incoming" "$APP_DIR/releases/$commit"
    # One byte over the limit tells a too-big archive from one that fits exactly.
    head -c "$((PREVIEW_UPLOAD_MAX_BYTES + 1))" >"$archive"
    [ "$(stat -c %s "$archive")" -le "$PREVIEW_UPLOAD_MAX_BYTES" ] || refuse "the archive is too big"
    # No member may be an absolute path or climb out with `..`.
    listing=$(tar -tzf "$archive") || refuse "the archive is not a readable .tar.gz"
    ! grep -Eq '(^|/)\.\.(/|$)|^/' <<<"$listing" || refuse "the archive has a path that leaves the release"
    # What it unpacks to, from its listing, before anything is written (#1346).
    unpacked=$(unpacked_bytes "$archive") || refuse "the archive's listing can't be measured"
    [ "$unpacked" -le "$PREVIEW_UNPACK_MAX_BYTES" ] || refuse "the archive unpacks to more than is allowed"
    mkdir "$incoming"
    tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$incoming" || refuse "the archive did not unpack"
    links_stay_inside "$incoming" || refuse "the release has a link that leads outside it"
    mv -T "$incoming" "$APP_DIR/releases/$commit"
    echo "::notice title=Preview::preview $number: release uploaded"
    ;;

  deploy)
    release="$APP_DIR/releases/$commit"
    [ -d "$release" ] && [ ! -L "$release" ] || refuse "that release was not uploaded"
    # The block first: deploy-release.sh stops when it is missing. Both scripts below are main's.
    sudo_caddy "$number"
    export PREVIEW_NUMBER CODE_DIR="$release"
    bash "$here/deploy-release.sh"
    # Proof, as this account and with the preview running, that it can't reach production (#1346). When it
    # can, the preview comes down again and the deploy fails, so unreviewed code never stays up beside it.
    if ! bash "$here/preview-isolation-check.sh"; then
      take_down || true
      refuse "the isolation check failed, so the preview was taken down"
    fi
    ;;

  teardown)
    take_down
    echo "::notice title=Preview::preview $number: taken down"
    ;;
esac
