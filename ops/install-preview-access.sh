#!/usr/bin/env bash
# Installs the restricted account pull request previews deploy and run under (#1345). Run by every
# production deploy, from main's release, so what is on the server always matches this file; a
# preview deploy never runs it. It makes:
#   1. one Unix account (PREVIEW_USER): no password, no groups but its own, a shell only so sshd can
#      run the forced command, and a home that is root-owned (with a root-owned .ssh and
#      authorized_keys), so a preview app running as it can't add a key or replace the command;
#   2. PREVIEW_ROOT, owned by that account: the previews' folders, PM2 state and logs;
#   3. PREVIEW_ACCESS_DIR, root-owned: main's copy of the scripts the account may run (the wrapper,
#      the Caddy script, the deploy scripts they use, the two Caddy templates);
#   4. a sudo rule that lets the account run the Caddy script, and only it, with a pull request number
#      (1 to 6 digits, matched by sudoers itself; the script checks it again);
#   5. the account's authorized_keys line, last, once the rest works: `restrict` (no shell, port
#      forwarding, agent, X11 or terminal) and the wrapper as the forced command. The key is the
#      public half in ops/preview-deploy-key.pub, which is not a secret; the private half is the
#      only secret of the GitHub environment `preview`. No key file means no key line, and neither
#      does a failed guard or isolation check (#1346): ops/preview-host-guards.sh makes the account's
#      reach smaller (production's folders, cron and at, Caddy's admin endpoint), then
#      ops/preview-isolation-check.sh runs as the account, and only when both pass is a key line
#      written. A key line from an earlier run is taken out again when they stop passing.
#
# It changes NOTHING when anything is unexpected: a different account, a path that is a link or
# owned by someone else, a file this script did not write, a sshd that would not accept the key, a
# tool the account can't run. It says so as a warning. Every file it replaces is first copied to
# <file>.bak-preview-access-<UTC time>. It prints what it did as annotations and never a secret: the
# only key material it handles is public. If a step after the first change fails, it puts the sudo
# rule back, writes no key line and says so. Running it again changes nothing.
set -Eeuo pipefail
trap '' HUP

here=$(dirname "$0")
. "$here/lib.sh"
. "$here/preview-access-lib.sh"

SUDOERS_FILE="${SUDOERS_FILE:-/etc/sudoers.d/sprecher-east-preview}"
SUDOERS_MAIN="${SUDOERS_MAIN:-/etc/sudoers}"
PUBLIC_KEY_FILE="${PREVIEW_PUBLIC_KEY_FILE:-$CODE_DIR/ops/preview-deploy-key.pub}"
ROOT_UID="${PREVIEW_ACCESS_ROOT_UID:-0}" # root's id; a test run by someone else sets its own
ROOT_OWNER=root
MARKER="Managed by ops/install-preview-access.sh (#1345)"
# main's files the account may run, copied into PREVIEW_ACCESS_DIR/ops/ (the caddy/ ones into caddy/)
SCRIPTS="preview-wrapper.sh preview-caddy.sh preview-access-lib.sh preview-isolation-check.sh preview-host-guards.sh umami-lib.sh preview-settings.sh secret-lib.sh deploy-release.sh restart-app.sh migrate-lib.sh caddy-lock-lib.sh lib.sh environment.sh"
CADDY_FILES="preview-site.caddy preview-headers.caddy"
WRAPPER="$PREVIEW_ACCESS_DIR/ops/preview-wrapper.sh"
CADDY_SCRIPT="$PREVIEW_ACCESS_DIR/ops/preview-caddy.sh"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
changes=()

# Before the first change: say why, change nothing, and let the deploy go on.
doubt() { # <reason>
  report "WARNING: preview access was not installed: $1; nothing was changed"
  exit 0
}

# Prints the owner's user id, then the mode, of a path.
owner_uid() { stat -c %u -- "$1"; }
unsafe_mode() { (("8#$(stat -c %a -- "$1")" & 8#022)); } # writable by group or others

# A folder or file that exists must be what it should be: not a link, root-owned, not writable by others.
check_root_owned() { # <path> <d|f>
  [ ! -e "$1" ] && [ ! -L "$1" ] && return 0
  [ ! -L "$1" ] || doubt "$1 is a link"
  [ "-$2" = "-$([ -d "$1" ] && echo d || echo f)" ] || doubt "$1 is not what it should be"
  [ "$(owner_uid "$1")" = "$ROOT_UID" ] || doubt "$1 is not owned by root"
  ! unsafe_mode "$1" || doubt "$1 can be written by others"
}

# A file this script wrote: it holds the marker. Anything else there is somebody's own.
check_ours() { # <path>
  [ ! -e "$1" ] || grep -qF "$MARKER" "$1" || doubt "$1 exists and this script did not write it"
}

# True when every folder down to <path> can be entered, and the file itself run, by anyone.
world_can_run() { # <file>
  local p="$1"
  (("8#$(stat -c %a -- "$p")" & 8#001)) || return 1
  while [ "$p" != / ]; do
    p=$(dirname "$p")
    (("8#$(stat -c %a -- "$p")" & 8#001)) || return 1
  done
}

# ---- Everything is checked before anything is changed. ----

[ "$(id -u)" = 0 ] || doubt "this script was not run as root"
! is_preview || doubt "it only runs for production's deploy"
for tool in useradd getent visudo sshd runuser sudo node pm2 tar flock stat install ssh-keygen chown; do
  command -v "$tool" >/dev/null 2>&1 || doubt "$tool was not found"
done
[[ "$PREVIEW_USER" =~ ^[a-z][a-z0-9-]{2,30}$ ]] || doubt "the account name is not a plain lowercase name"
[ "$PREVIEW_USER" != "$(id -un)" ] || doubt "the preview account would be the deploy account"
for path in "$PREVIEW_HOME" "$PREVIEW_ROOT" "$PREVIEW_ACCESS_DIR"; do
  [[ "$path" =~ ^/[A-Za-z0-9_./-]+$ ]] && [[ "$path" != *..* ]] || doubt "a folder path has characters it should not"
done
case "$PREVIEW_ROOT" in "$PRODUCTION_DIR" | "$PRODUCTION_DIR"/* | "$PREVIEW_HOME" | "$PREVIEW_HOME"/*) doubt "the previews root is production's or the account's home" ;; esac

# The account, when it exists, is exactly the one this script would make.
user_exists=no
if entry=$(getent passwd "$PREVIEW_USER"); then
  user_exists=yes
  IFS=: read -r _ _ uid _ _ home shell <<<"$entry"
  [ "$uid" != 0 ] && [ "$home" = "$PREVIEW_HOME" ] && [ "$shell" = /bin/bash ] ||
    doubt "an account named $PREVIEW_USER exists with other settings (uid, home or shell)"
  [ "$(id -Gn "$PREVIEW_USER")" = "$PREVIEW_USER" ] || doubt "$PREVIEW_USER belongs to groups besides its own"
fi
# Not a folder somebody else owns.
if [ -e "$PREVIEW_ROOT" ] || [ -L "$PREVIEW_ROOT" ]; then
  [ -d "$PREVIEW_ROOT" ] && [ ! -L "$PREVIEW_ROOT" ] || doubt "$PREVIEW_ROOT is a link or not a folder"
  [ "$user_exists" = yes ] && [ "$(owner_uid "$PREVIEW_ROOT")" = "$(id -u "$PREVIEW_USER")" ] ||
    doubt "$PREVIEW_ROOT exists and is not owned by $PREVIEW_USER"
fi
check_root_owned "$PREVIEW_HOME" d
check_root_owned "$PREVIEW_HOME/.ssh" d
check_root_owned "$PREVIEW_HOME/.ssh/authorized_keys" f
check_ours "$PREVIEW_HOME/.ssh/authorized_keys"
check_root_owned "$PREVIEW_ACCESS_DIR" d
for sub in ops ops/caddy; do check_root_owned "$PREVIEW_ACCESS_DIR/$sub" d; done
check_root_owned "$SUDOERS_FILE" f
check_ours "$SUDOERS_FILE"
[ -d "$(dirname "$SUDOERS_FILE")" ] || doubt "$(dirname "$SUDOERS_FILE") does not exist"
grep -Eq "^[#@]includedir[[:space:]]+$(dirname "$SUDOERS_FILE")" "$SUDOERS_MAIN" 2>/dev/null ||
  doubt "sudo does not read $(dirname "$SUDOERS_FILE")"

# The files to copy exist in this release.
for f in $SCRIPTS; do [ -f "$CODE_DIR/ops/$f" ] || doubt "ops/$f is missing from this release"; done
for f in $CADDY_FILES; do [ -f "$CODE_DIR/ops/caddy/$f" ] || doubt "ops/caddy/$f is missing from this release"; done

# node and pm2 must be usable by the account: not under a home folder it can't enter.
tools=""
for tool in node pm2; do
  tool_path=$(command -v "$tool")
  world_can_run "$(readlink -f "$tool_path")" || doubt "$tool ($tool_path) can't be run by other accounts"
  dir=$(dirname "$tool_path")
  case ":$tools:" in *":$dir:"*) ;; *) tools="${tools:+$tools:}$dir" ;; esac
done
[[ "$tools" =~ ^/[A-Za-z0-9_./:@+-]*$ ]] || doubt "the folder of node or pm2 has characters it should not"

# sshd must take the key line as written, for this account.
sshd_settings=$(sshd -T -C "user=$PREVIEW_USER,host=localhost,addr=127.0.0.1" 2>/dev/null) ||
  doubt "sshd would not print its settings for the account"
sshd_value() { awk -v k="$1" 'tolower($1) == k { sub(/^[^ ]+ /, ""); print }' <<<"$sshd_settings"; } # every line of the setting
[ "$(sshd_value pubkeyauthentication)" = yes ] || doubt "sshd does not allow public key sign-in"
case " $(sshd_value authorizedkeysfile) " in *" .ssh/authorized_keys "* | *" %h/.ssh/authorized_keys "*) ;; *) doubt "sshd reads other authorized_keys files" ;; esac
[ -z "$(sshd_value allowgroups)" ] || doubt "sshd has AllowGroups, which this script can't judge"
[ -z "$(sshd_value allowusers)" ] || case " $(sshd_value allowusers) " in *" $PREVIEW_USER "*) ;; *) doubt "sshd's AllowUsers leaves out $PREVIEW_USER" ;; esac
case " $(sshd_value denyusers) " in *" $PREVIEW_USER "*) doubt "sshd's DenyUsers names $PREVIEW_USER" ;; esac
# The account has no password (locked), which sshd takes only with PAM; nothing may let the client or a
# command change what the forced command sees or runs.
[ "$(sshd_value usepam)" = yes ] || doubt "sshd has UsePAM off, and it refuses key sign-in to an account with no password"
[ "$(sshd_value permituserenvironment)" = no ] || doubt "sshd allows PermitUserEnvironment"
set -f # a value such as * is a name to judge, not a pattern for the files in this folder
for accepted in $(sshd_value acceptenv); do
  [[ "$accepted" == LANG || "$accepted" == LC_* ]] || doubt "sshd's AcceptEnv takes $accepted from the client"
done
set +f
[ "$(sshd_value authorizedkeyscommand)" = none ] || doubt "sshd has an AuthorizedKeysCommand"
[ "$(sshd_value forcecommand)" = none ] || doubt "sshd has a ForceCommand for the account"

# The root script runs with a fixed PATH (ROOT_SECURE_PATH, also sudo's secure_path for it): the tools it
# calls must be in it.
[[ "$ROOT_SECURE_PATH" =~ ^/[A-Za-z0-9_./:@+-]*$ ]] || doubt "the root script's PATH has characters it should not"
for tool in caddy systemctl flock; do
  (PATH="$ROOT_SECURE_PATH" command -v "$tool" >/dev/null 2>&1) || doubt "$tool is not in $ROOT_SECURE_PATH, the PATH the Caddy script runs with"
done

# The public key: one ed25519 line, nothing before the type (no options, so it can't loosen `restrict`).
key_line=""
key_note="no preview key file: no key allowed"
fingerprint=""
if [ -f "$PUBLIC_KEY_FILE" ]; then
  line=$(cat "$PUBLIC_KEY_FILE")
  [[ "$line" =~ ^ssh-ed25519\ AAAAC3NzaC1lZDI1NTE5[A-Za-z0-9+/]{48}(\ [A-Za-z0-9@._-]{1,64})?$ ]] ||
    doubt "the preview key file is not a plain ed25519 public key"
  fingerprint=$(ssh-keygen -lf "$PUBLIC_KEY_FILE" 2>/dev/null | awk '{ print $2 }') || fingerprint=""
  [ -n "$fingerprint" ] || doubt "ssh-keygen would not read the preview key"
  read -r key_type key_blob _ <<<"$line"
  key_line="restrict,command=\"$WRAPPER\" $key_type $key_blob sprecher-east-preview-deploy"
fi

# ---- What the files should hold. ----


sudo_args=""
digits="[1-9]"
for _ in 1 2 3 4 5 6; do
  sudo_args+="${sudo_args:+, }$CADDY_SCRIPT $digits"
  digits+="[0-9]"
done
sudoers_text=$(
  printf '# %s. Changes here are overwritten on deploy.\n' "$MARKER"
  printf '# The preview account may run main'"'"'s Caddy script with a pull request number, and nothing else.\n'
  printf 'Defaults!%s env_reset, !setenv, secure_path="%s"\n' "$CADDY_SCRIPT" "$ROOT_SECURE_PATH"
  printf '%s ALL=(root) NOPASSWD: %s\n' "$PREVIEW_USER" "$sudo_args"
)

# Writes <text> to <path> (mode, owner root) when it differs, keeping a dated copy of the old one.
# The new file is complete before it replaces the old one in a single rename. Returns 0 when it changed
# the file, 1 when it was already right and 2 when a step failed (it runs inside an `if`, where `set -e`
# does not apply, so each step says so itself).
put_file() { # <path> <mode> <source file or - for $text> [text]
  local path="$1" mode="$2" tmp
  tmp=$(mktemp "$path.new-XXXXXX") # if it failed, the write below fails too
  if [ "$3" = - ]; then printf '%s\n' "$4" >"$tmp" || { rm -f "$tmp"; return 2; }; else cat "$3" >"$tmp" || { rm -f "$tmp"; return 2; }; fi
  if cmp -s "$tmp" "$path" 2>/dev/null; then
    rm -f "$tmp"
    return 1
  fi
  # a step that fails leaves no half-made file behind (mktemp, run as root, makes it root-owned)
  chmod "$mode" "$tmp" || { rm -f "$tmp"; return 2; }
  if [ -e "$path" ]; then cp -p "$path" "$path.bak-preview-access-$stamp" || { rm -f "$tmp"; return 2; }; fi
  mv -f "$tmp" "$path" || { rm -f "$tmp"; return 2; }
}
# put_file, ending the run (and putting back what it changed) when a step failed. Returns 0 or 1.
install_file() { # as put_file
  local status=0
  put_file "$@" || status=$?
  [ "$status" != 2 ] || fail_after_change "could not write $1"
  return "$status"
}

# What this run changed, so a failure can put the sudo rule back (the key line goes in last, after which
# nothing can fail).
restore() { # <path>
  if [ -e "$1.bak-preview-access-$stamp" ]; then mv -f "$1.bak-preview-access-$stamp" "$1"; else rm -f "$1"; fi
}
fail_after_change() { # <what went wrong>
  trap - ERR
  [ "${sudoers_changed:-no}" = no ] || restore "$SUDOERS_FILE"
  report "ERROR: preview access: $1; the sudo rule from this run was put back and no key line was written"
  exit 1
}
trap 'fail_after_change "the installer failed unexpectedly at line $LINENO"' ERR

# ---- Changes. ----

sudoers_changed=no

if [ "$user_exists" = no ]; then
  useradd --system --user-group --no-create-home --home-dir "$PREVIEW_HOME" --shell /bin/bash "$PREVIEW_USER"
  changes+=("account $PREVIEW_USER made")
fi
for dir in "$PREVIEW_HOME" "$PREVIEW_HOME/.ssh" "$PREVIEW_ACCESS_DIR" "$PREVIEW_ACCESS_DIR/ops" "$PREVIEW_ACCESS_DIR/ops/caddy"; do
  if [ ! -d "$dir" ]; then
    install -d -m 755 "$dir"
    chown "$ROOT_OWNER:$ROOT_OWNER" "$dir"
    changes+=("$dir made, root-owned")
  fi
done
if [ ! -d "$PREVIEW_ROOT" ]; then
  install -d -m 750 "$PREVIEW_ROOT"
  chown "$PREVIEW_USER:$PREVIEW_USER" "$PREVIEW_ROOT"
  changes+=("$PREVIEW_ROOT made, owned by $PREVIEW_USER")
fi

copied=0
for f in $SCRIPTS; do
  if install_file "$PREVIEW_ACCESS_DIR/ops/$f" 755 "$CODE_DIR/ops/$f"; then copied=$((copied + 1)); fi
done
for f in $CADDY_FILES; do
  if install_file "$PREVIEW_ACCESS_DIR/ops/caddy/$f" 644 "$CODE_DIR/ops/caddy/$f"; then copied=$((copied + 1)); fi
done
if install_file "$PREVIEW_ACCESS_DIR/tools-path" 644 - "$tools"; then copied=$((copied + 1)); fi
[ "$copied" = 0 ] || changes+=("$copied root-owned script files updated in $PREVIEW_ACCESS_DIR")

# The sudo rule, checked by visudo before it is in place.
sudoers_candidate=$(mktemp "$SUDOERS_FILE.check-XXXXXX") # a name with a dot: sudo ignores it
printf '%s\n' "$sudoers_text" >"$sudoers_candidate"
if ! visudo -cf "$sudoers_candidate" >/dev/null 2>&1; then
  rm -f "$sudoers_candidate"
  fail_after_change "visudo rejected the sudo rule"
fi
rm -f "$sudoers_candidate"
if install_file "$SUDOERS_FILE" 440 - "$sudoers_text"; then
  sudoers_changed=yes
  changes+=("sudo rule for the Caddy script installed")
fi

# What the account can do, run as the account.
as_preview() { runuser -u "$PREVIEW_USER" -- "$@"; }
facts=$(as_preview env SSH_ORIGINAL_COMMAND=facts "$WRAPPER" 2>/dev/null) || fail_after_change "the account could not run the wrapper"
case "$facts" in *node=*) ;; *) fail_after_change "the wrapper's facts did not report Node" ;; esac
if as_preview env SSH_ORIGINAL_COMMAND='sh -c id' "$WRAPPER" >/dev/null 2>&1; then
  fail_after_change "the wrapper ran a command that is not one of its actions"
fi
for path in "$PREVIEW_HOME" "$PREVIEW_HOME/.ssh" "$PREVIEW_HOME/.ssh/authorized_keys"; do
  if as_preview test -w "$path"; then fail_after_change "the account can write to $path"; fi
done
sudo_list=$(sudo -l -U "$PREVIEW_USER" 2>/dev/null || true)
case "$sudo_list" in *"$CADDY_SCRIPT"*) ;; *) fail_after_change "sudo does not list the Caddy script for the account" ;; esac

# What the account can reach (#1346). The guards make it smaller, then the isolation check proves it, run
# as the account with the guards in place. Both print their own annotations, never a file's content. A key
# line is written only when both pass, and an old one is taken out when they stop passing (keys_text is
# rebuilt every run). Without a key file they still run, so the deploy's annotations show the result.
guards_status=0
bash "$here/preview-host-guards.sh" || guards_status=$?
isolation_status=0
(cd / && as_preview bash "$PREVIEW_ACCESS_DIR/ops/preview-isolation-check.sh") || isolation_status=$?
if [ -n "$key_line" ] && { [ "$guards_status" != 0 ] || [ "$isolation_status" != 0 ]; }; then
  key_line=""
  key_note="no key allowed: the host guards or the isolation check did not pass (above), so a preview must not run as the account"
fi
keys_text=$(printf '# %s. Changes here are overwritten on deploy.\n' "$MARKER")
[ -z "$key_line" ] || keys_text+=$'\n'"$key_line"

# The key line goes in last.
if install_file "$PREVIEW_HOME/.ssh/authorized_keys" 644 - "$keys_text"; then
  if [ -n "$key_line" ]; then
    changes+=("key $fingerprint allowed, restricted to the wrapper")
  else
    changes+=("$key_note")
  fi
fi

trap - ERR
# One line on every run, whether or not anything changed, so the deploy's output always says whether a key
# is allowed and what the two checks said (the first production run printed neither, #1075).
key_state="$key_note"
[ -z "$key_line" ] || key_state="key $fingerprint allowed"
passed() { [ "$1" = 0 ] && echo passed || echo "did not pass (status $1)"; }
report "Preview access: $key_state; host guards $(passed "$guards_status"); isolation check $(passed "$isolation_status")"
if [ "${#changes[@]}" = 0 ]; then
  [ -z "$key_line" ] || key_state="key $fingerprint"
  report "Preview access already in place: account $PREVIEW_USER, wrapper in $PREVIEW_ACCESS_DIR, $key_state"
else
  printf '%s\n' "Preview access installed (backups of replaced files: <file>.bak-preview-access-$stamp):" "${changes[@]/#/- }" |
    report_lines notice Server
fi
