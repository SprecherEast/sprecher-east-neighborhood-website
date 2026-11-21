#!/bin/bash
# The only thing the pull request preview deploy key can run (#1345). The key's line in
# authorized_keys is `restrict,command="<this file>" <key>`, so whatever the client asks for arrives
# here as SSH_ORIGINAL_COMMAND, and a shell, a port forward or any other command never starts.
# The production deploy installs this file, root-owned, from main (ops/install-preview-access.sh);
# a preview deploy never writes it. It runs as the unprivileged preview account.
#
# Actions (one line, words separated by single spaces):
#   facts                      public facts about the server, for the build (Node version, free disk)
#   list                       every preview, or leftover of one, found anywhere: its commit, how long ago it was
#                              last deployed, and whether its folder, Caddy block and PM2 process exist (#1076)
#   upload <number> <commit>   a release archive (.tar.gz) on stdin, unpacked into the preview's folder
#   deploy <number> <commit>   puts that uploaded release live (Caddy block, a fresh copy of production's published
#                              content, then ops/deploy-release.sh; the preview's database is rebuilt every time, #1397)
#   teardown <number>          stops the preview, deletes its folder and its Caddy block; a second run, or one for a
#                              number with only leftovers (a block, a process), succeeds too
#   credentials <number>       prints the preview's test sign-in (#1394), only when the seed applied exactly it
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
# shellcheck source=secret-lib.sh
. "$here/secret-lib.sh" # the one definition of a generated secret's shape (is_secret)
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
  credentials)
    [ -n "$number" ] || refuse "credentials needs a number"
    [ -z "$commit" ] || refuse "credentials takes only a number"
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
# Production's published content for this preview (#1397, ops/preview-copy.sh): the root step makes the snapshot,
# runs main's export and links the media the export lists into an empty staging folder; its standard output is the
# export's file, which this account writes (so root never writes a path this account can swap). Only when it all
# succeeded is the preview's old database and media replaced, so a failed copy leaves the preview as it was. The
# database is rebuilt on every deploy: changes made while testing a preview are lost on the next push.
copy_content() {
  local file_new="$COPY_FILE.new"
  # Room for the largest file the root step may hand over, above production's floor
  enough_disk "$PREVIEW_ROOT" "$PREVIEW_COPY_MAX_BYTES" || refuse "$no_disk"
  rm -rf -- "$COPY_MEDIA_DIR" "$COPY_FILE" "$file_new"
  mkdir "$COPY_MEDIA_DIR"
  local status=0
  # Its standard error carries only numbers and fixed texts, and goes to the log; the file is never printed.
  (umask 077 && sudo -n "$PREVIEW_ACCESS_DIR/ops/preview-copy.sh" "$number" >"$file_new") || status=$?
  if [ "$status" != 0 ] || [ ! -s "$file_new" ]; then
    rm -rf -- "$COPY_MEDIA_DIR" "$file_new"
    refuse "the content copy failed, so the preview was not changed"
  fi
  rm -rf -- "$DATA_DIR" "$MEDIA_DIR"
  mkdir -p "$APP_DIR/public"
  mv -T "$COPY_MEDIA_DIR" "$MEDIA_DIR"
  mv -T "$file_new" "$COPY_FILE"
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

# What the previews' disk refuses (the rule itself is enough_disk, preview-access-lib.sh).
no_disk="there is not enough free disk to put this preview up and keep production's floor"

# PM2's processes that belong to a preview, one `<name> <online|stopped>` line each. `pm2 jlist` prints one line of
# JSON, which may follow lines of PM2's own notices. The name's prefix comes from environment.sh, and bash checks
# the number behind it: nothing PM2 prints reaches a path or a command otherwise.
process_states() { # <name prefix>
  pm2 jlist 2>/dev/null | node -e '
    const lines = require("fs").readFileSync(0, "utf8").split("\n").reverse();
    for (const line of lines) {
      if (!line.startsWith("[")) continue;
      let list;
      try { list = JSON.parse(line); } catch { continue; }
      if (!Array.isArray(list)) continue;
      for (const p of list) {
        const name = String(p && p.name);
        if (name.startsWith(process.argv[1]) && /^[A-Za-z0-9_-]+$/.test(name))
          console.log(name + " " + (p.pm2_env && p.pm2_env.status === "online" ? "online" : "stopped"));
      }
      break;
    }' "$1" || true
}

# Proof, as this account, that it can't reach production (#1346). When it can, the preview comes down and
# the request fails, so unreviewed code never stays up (or starts) beside production.
isolated_or_down() {
  if ! bash "$here/preview-isolation-check.sh"; then
    take_down || true
    refuse "the isolation check failed, so the preview was taken down"
  fi
}

case "$action" in
  facts)
    echo "node=$(node -v)"
    echo "account=$(id -un)"
    echo "free_kb=$(df -Pk "$PREVIEW_ROOT" | awk 'NR == 2 { print $4 }')"
    ;;

  list)
    # Everything that exists for a pull request number, wherever it is found (the folder, the Caddy block, the PM2
    # process), so the nightly sweep sees a leftover that has no folder too (#1076). One line per number, lowest
    # first. `idle` is the seconds since the live release was switched in (the folder's age when none is).
    now=$(date +%s)
    prefix=${APP_NAME%"$PREVIEW_NUMBER"}
    declare -A has_folder=() has_block=() process=()
    for folder in "$PREVIEW_ROOT"/pr-*; do
      [ -d "$folder" ] && [ ! -L "$folder" ] || continue
      id=${folder##*/pr-}
      ! valid_preview_number "$id" || has_folder[$id]=yes
    done
    for file in "$PREVIEW_CADDY_DIR"/pr-*.caddy; do
      [ -f "$file" ] && [ ! -L "$file" ] || continue
      id=${file##*/pr-}
      id=${id%.caddy}
      ! valid_preview_number "$id" || has_block[$id]=yes
    done
    while read -r name state; do
      id=${name#"$prefix"}
      ! valid_preview_number "$id" || process[$id]=$state
    done < <(process_states "$prefix")
    ids=$(printf '%s\n' "${!has_folder[@]}" "${!has_block[@]}" "${!process[@]}" | sed -n '/^[0-9][0-9]*$/p' | sort -nu)
    for id in $ids; do
      folder="$PREVIEW_ROOT/pr-$id"
      live=$(readlink "$folder/current" 2>/dev/null || true)
      live=${live#releases/}
      valid_commit "$live" || live=none
      changed=$(stat -c %Y -- "$folder/current" 2>/dev/null || stat -c %Y -- "$folder" 2>/dev/null || echo "$now")
      idle=$((now - changed))
      [ "$idle" -ge 0 ] || idle=0
      echo "preview=$id commit=$live idle=$idle folder=${has_folder[$id]:-no} block=${has_block[$id]:-no} process=${process[$id]:-none}"
    done
    ;;

  upload)
    # The cap and the creation of the folder are one step under a lock, so two previews that start together
    # can't both take the last place. The lock is dropped before the archive is read, which can be slow.
    created=no
    [ -d "$APP_DIR" ] || created=yes
    (
      flock 8
      if [ "$created" = yes ]; then # a new preview: not beyond the cap
        count=$(find "$PREVIEW_ROOT" -maxdepth 1 -type d -name 'pr-*' | wc -l)
        [ "$count" -lt "$PREVIEW_MAX_COUNT" ] || refuse "there are already as many previews as are allowed"
      fi
      [ ! -L "$APP_DIR/releases" ] || refuse "releases is a link"
      mkdir -p "$APP_DIR/releases"
    ) 8>"$PREVIEW_ROOT/.cap-lock"
    uploaded=no
    archive="$APP_DIR/releases/.incoming-$commit.tar.gz"
    incoming="$APP_DIR/releases/.incoming-$commit"
    # A new preview that did not get its release leaves no empty folder behind: it would hold a place under the cap.
    trap 'rm -rf "$archive" "$incoming"; [ "$created" != yes ] || [ "$uploaded" = yes ] || rm -rf -- "${APP_DIR:?}"' EXIT
    [ "$(readlink "$APP_DIR/current" 2>/dev/null || true)" != "releases/$commit" ] ||
      refuse "that release is live; not replacing it"
    # Before reading anything: room for the largest archive that may be sent, above production's floor (#1076).
    enough_disk "$PREVIEW_ROOT" "$PREVIEW_UPLOAD_MAX_BYTES" || refuse "$no_disk"
    rm -rf "$archive" "$incoming" "$APP_DIR/releases/$commit"
    # One byte over the limit tells a too-big archive from one that fits exactly.
    head -c "$((PREVIEW_UPLOAD_MAX_BYTES + 1))" >"$archive"
    archive_bytes=$(stat -c %s "$archive")
    [ "$archive_bytes" -le "$PREVIEW_UPLOAD_MAX_BYTES" ] || refuse "the archive is too big"
    # No member may be an absolute path or climb out with `..`.
    listing=$(tar -tzf "$archive") || refuse "the archive is not a readable .tar.gz"
    ! grep -Eq '(^|/)\.\.(/|$)|^/' <<<"$listing" || refuse "the archive has a path that leaves the release"
    # What it unpacks to, from its listing, before anything is written (#1346).
    measured=0
    unpacked=$(unpacked_bytes "$archive" "$PREVIEW_UNPACK_MAX_BYTES") || measured=$?
    [ "$measured" != 2 ] || refuse "the archive unpacks to more than is allowed"
    [ "$measured" = 0 ] || refuse "the archive's listing can't be measured"
    # At its peak the folder holds the archive and what it unpacks to: that must leave production's floor free.
    enough_disk "$PREVIEW_ROOT" "$((archive_bytes + unpacked))" || refuse "$no_disk"
    mkdir "$incoming"
    tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$incoming" || refuse "the archive did not unpack"
    links_stay_inside "$incoming" || refuse "the release has a link that leads outside it"
    mv -T "$incoming" "$APP_DIR/releases/$commit"
    uploaded=yes
    echo "::notice title=Preview::preview $number: release uploaded"
    ;;

  deploy)
    release="$APP_DIR/releases/$commit"
    [ -d "$release" ] && [ ! -L "$release" ] || refuse "that release was not uploaded"
    # Before anything of the release runs: a guard can lapse between production deploys (a firewall reload
    # drops a rule, a mode is put back), and unreviewed code must not start with that reach.
    isolated_or_down
    # The block first: deploy-release.sh stops when it is missing. Both scripts below are main's.
    sudo_caddy "$number"
    copy_content
    export PREVIEW_NUMBER CODE_DIR="$release"
    deployed=0
    bash "$here/deploy-release.sh" || deployed=$?
    # The import deletes its file; whatever is left (a failed deploy) goes now.
    rm -rf -- "$COPY_FILE" "$COPY_MEDIA_DIR"
    # Again with the preview running, and also when the deploy failed, so a failed deploy is checked too.
    isolated_or_down
    exit "$deployed"
    ;;

  teardown)
    take_down
    echo "::notice title=Preview::preview $number: taken down"
    ;;

  credentials)
    # The test accounts' passwords (ops/preview-accounts.sh), for the requester to seal and read (#1394). Handed
    # out only when the seed confirmed this exact file: `.preview-accounts.applied` holds the file's SHA-256,
    # written by the seed after it gave every account its password. After a failed seed, or on a branch whose
    # seed ignores the file, the file holds passwords that match no account, so none are served. The file is
    # read once and its text is what is checked and what is printed. Nothing here logs it; the caller
    # (.github/scripts/preview-credentials.sh) seals it before anything reaches a public log.
    [ -d "$APP_DIR" ] || refuse "there is no such preview"
    applied="$ACCOUNTS_FILE.applied"
    none="the preview has no test sign-in to hand out (not made, or the last deploy did not finish it)"
    [ -f "$ACCOUNTS_FILE" ] && [ ! -L "$ACCOUNTS_FILE" ] && [ -f "$applied" ] && [ ! -L "$applied" ] || refuse "$none"
    [ "$(stat -c %a "$ACCOUNTS_FILE")" = 600 ] || refuse "$none"
    content=$(cat -- "$ACCOUNTS_FILE"; printf x) || refuse "$none"
    content=${content%x}
    marker=""
    IFS= read -r marker <"$applied" || true
    digest=$(printf '%s' "$content" | sha256sum)
    [ "${digest%% *}" = "$marker" ] || refuse "$none"
    # Exactly what ops/preview-accounts.sh writes: for each role, in order, one `<role>=<secret>` line (the shape
    # is secret-lib.sh's `is_secret`), and a newline after the last one. Anything else is not handed out.
    rest=$content
    for role in $PREVIEW_ACCOUNT_ROLES; do
      line=${rest%%$'\n'*}
      [ "$line" != "$rest" ] || refuse "$none" # no newline: a missing line, or no newline at the end
      rest=${rest#*$'\n'}
      [ "${line%%=*}" = "$role" ] && is_secret "${line#*=}" || refuse "$none"
    done
    [ -z "$rest" ] || refuse "$none"
    printf '%s' "$content"
    ;;
esac
