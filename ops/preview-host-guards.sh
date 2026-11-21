#!/usr/bin/env bash
# Keeps the pull request preview account away from the rest of the server (#1346). Run as root by
# ops/install-preview-access.sh on every production deploy, and once at boot by a systemd unit it installs
# (argument `boot`: only the firewall rule). It does three things, and each makes no change on any doubt,
# says so as a warning and leaves the others to go on:
#   1. production's private folders (its app folder, the backups, Umami's folder, PM2's log folder) lose
#      their access for "others": the production deploy runs with umask 022, so what it writes (the logs
#      too, under PM2) is readable by every account. A folder is closed only when all of this is true,
#      and otherwise left as it is, with a warning: it is a real folder, it and what is directly in it are
#      owned by root, Caddy's live configuration (`caddy adapt` of the Caddyfile, and a text search of the
#      Caddyfile and the files beside it, as a cheap first filter) names no path in it, and no process that
#      isn't root's has it as its working folder or an open file in it. Then Caddy itself is the proof of
#      what it reads from the Caddyfile: `caddy adapt` as Caddy's service user (from /, with HOME, PATH and the
#      unit's Environment= and EnvironmentFile=) must give what root's gives, before the change and again after all of them, and
#      `caddy validate` must pass (certificates, logs). A glob over a folder Caddy's user can't open matches
#      nothing without an error, so only the output's equality shows it. When the second run differs or
#      fails, every mode changed in this run is put back, also when the script is stopped half way. When
#      Caddy's user can't be found, is root, `runuser` is missing, or Caddy's lock is held, nothing is closed.
#      The window is under Caddy's lock, so no preview reload runs in it. What this can't see: a non-root
#      service that opens a file there by name only from time to time, and what Caddy opens only when it
#      runs (the sites it serves). The old mode is logged before each change, and in the annotation.
#   2. the account goes into /etc/cron.deny and /etc/at.deny, so a preview can't schedule a job that outlives
#      its teardown. at.deny is never created (when neither at file exists only root may use at, and a new
#      at.deny would open it to everyone else).
#   3. an owner-match firewall rule refuses the account's connections to Caddy's admin endpoint on
#      localhost. A unix socket was the other choice: it moves the endpoint, which `caddy reload` and every
#      script that talks to Caddy would then have to find (decision on #1346). The rule is made for IPv4
#      and IPv6, only when root can reach the endpoint (so the rule protects something), and a systemd unit
#      puts it back at boot. Both the rule and the unit are ours, marked, and removed by deleting them.
# Exit 0: everything is in place. Exit 3: something was not (the installer then writes no key line).
set -uo pipefail
here=$(dirname "$0")
. "$here/lib.sh"
. "$here/preview-access-lib.sh" # ROOT_UID and root_only_writable
. "$here/umami-lib.sh"
. "$here/caddy-lock-lib.sh"

production="${PRODUCTION_DIR_FOR_TESTS:-$PRODUCTION_DIR}" # a test points it at a stand-in folder
PROC_DIR="${PROC_DIR:-/proc}"
CRON_ALLOW="${CRON_ALLOW_FILE:-/etc/cron.allow}"
CRON_DENY="${CRON_DENY_FILE:-/etc/cron.deny}"
AT_ALLOW="${AT_ALLOW_FILE:-/etc/at.allow}"
AT_DENY="${AT_DENY_FILE:-/etc/at.deny}"
UNIT_FILE="${PREVIEW_FIREWALL_UNIT:-/etc/systemd/system/sprecher-east-preview-firewall.service}"
RULE_COMMENT="sprecher-east-preview-caddy-admin"
MARKER="Managed by ops/preview-host-guards.sh (#1346)"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
status=0
changes=()

warn() { # <reason>: nothing was changed for this guard
  report "WARNING: preview host guard not applied: $1; nothing was changed for it"
  status=3
}

# ---- The firewall rule (also what the unit runs at boot). ----

# Puts the rule in OUTPUT, first, for IPv4 and IPv6, unless it is there. Returns 1 when one could not.
apply_rule() { # <uid>
  local ipt
  local rule=(-o lo -p tcp --dport "$CADDY_ADMIN_PORT" -m owner --uid-owner "$1" -m comment --comment "$RULE_COMMENT" -j REJECT --reject-with tcp-reset)
  for ipt in iptables ip6tables; do
    "$ipt" -w -C OUTPUT "${rule[@]}" 2>/dev/null && continue
    "$ipt" -w -I OUTPUT 1 "${rule[@]}" || return 1
    changes+=("$ipt rule: connections from $PREVIEW_USER to localhost port $CADDY_ADMIN_PORT are refused")
  done
}

if [ "${1-}" = boot ]; then
  uid=$(id -u "$PREVIEW_USER") && [[ "$uid" =~ ^[1-9][0-9]*$ ]] || exit 1
  apply_rule "$uid"
  exit
fi

# ---- 1. Production's private folders. ----

# Prints why a folder is needed by something that isn't root, or nothing when nothing says so.
folder_needed() { # <folder>
  local adapted proc uid ref target pattern found scan
  adapted=$(caddy adapt --config "$CADDYFILE" --adapter caddyfile 2>/dev/null) && [[ "$adapted" == *[![:space:]]* ]] || { echo "caddy adapt could not read the live Caddyfile, so what Caddy serves or writes is unknown"; return; }
  if [[ "$adapted" == *"$1"/* || "$adapted" == *"$1\""* ]]; then echo "Caddy's configuration names a path in it"; return; fi
  # `caddy adapt` pastes an imported file's text in place, so the path of an import is not in what it prints:
  # the Caddyfile and every file beside it (the previews' blocks too) are read for the path as well. This is
  # a first filter; Caddy's own reading, after the change, is the proof (see below). grep: 0 found, 1 clean.
  pattern=$(printf '%s' "$1" | sed 's/[][\\.*^$+?(){}|]/\\&/g')
  scan=("$CADDYFILE" "${CADDYFILE%/*}")
  [ ! -d "$PREVIEW_CADDY_DIR" ] || scan+=("$PREVIEW_CADDY_DIR")
  found=$(grep -rlEs -e "$pattern([^A-Za-z0-9_.-]|\$)" -- "${scan[@]}")
  case $? in
    0) echo "${found%%$'\n'*} (Caddy's own configuration, backups included) names a path in it"; return ;;
    1) ;;
    *) echo "the Caddyfile and the files beside it could not all be read"; return ;;
  esac
  for proc in "$PROC_DIR"/[0-9]*; do
    uid=$(awk '/^Uid:/ { print $3 }' "$proc/status" 2>/dev/null)
    [ -n "$uid" ] && [ "$uid" != "$ROOT_UID" ] || continue
    for ref in "$proc/cwd" "$proc"/fd/*; do
      target=$(readlink "$ref" 2>/dev/null) || continue
      case "$target" in "$1" | "$1"/*) echo "a process that isn't root's (pid ${proc##*/}) has it open"; return ;; esac
    done
  done
}

# Caddy's own proof, as its service user: what Caddy reads from the Caddyfile (`caddy adapt`, which pastes
# every import in) must be the same after the change as root reads it before, and `caddy validate` must pass
# (certificates, logs). Both run from / with a clean environment: HOME, PATH and what the unit's Environment= and
# EnvironmentFile= set (not PassEnvironment= or what `systemctl set-environment` gave).
# Sets caddy_user, caddy_bin and caddy_reference, or caddy_doubt.
caddy_doubt=
caddy_prepared=
caddy_env=()
doubt() { [ -n "$caddy_doubt" ] || caddy_doubt="$1"; } # the first reason is kept
prepare_caddy_proof() {
  local uid pair pairs entry file line
  caddy_prepared=yes
  caddy_user=$(systemctl show -p User --value caddy 2>/dev/null)
  uid=$(id -u "$caddy_user" 2>/dev/null)
  caddy_bin=$(command -v caddy)
  if [ -z "$caddy_user" ] || ! [[ "$uid" =~ ^[0-9]+$ ]]; then
    caddy_doubt="Caddy's service user could not be found"
  elif [ "$uid" = "$ROOT_UID" ]; then
    caddy_doubt="Caddy runs as root, so its reading of the folders can't be proven"
  elif ! command -v runuser >/dev/null || [ -z "$caddy_bin" ]; then
    caddy_doubt="runuser or caddy is missing, so Caddy can't be run as its own user"
  elif ! take_caddy_lock; then
    caddy_doubt="another change to Caddy is running (its lock could not be taken), so nothing is closed now"
  else
    # What the service's environment is: HOME and PATH, and the unit's Environment= and EnvironmentFile=
    # (PassEnvironment=, DefaultEnvironment= and `systemctl set-environment` are not read). Only plain
    # KEY=value entries are taken: systemd strips quotes and keeps spaces in a value, and splitting that here
    # could give Caddy another value than the service has, so anything else is a doubt (the first one is kept).
    caddy_env=("HOME=$CADDY_STORAGE_DIR" "PATH=$PATH")
    plain='^[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9_./:@%+,=-]*$'
    read -ra pairs <<<"$(systemctl show -p Environment --value caddy 2>/dev/null)" # no glob expansion
    for pair in "${pairs[@]}"; do
      if [[ "$pair" =~ $plain ]]; then caddy_env+=("$pair"); else doubt "the unit's Environment has an entry that is not a plain KEY=value"; fi
    done
    # `systemctl show` prints each file as "<path> (ignore_errors=yes|no)": yes is a file with a `-` in the unit,
    # which systemd skips when it is missing; any other file that can't be read is a doubt.
    while IFS= read -r entry; do
      [ -n "$entry" ] || continue
      file=${entry% (ignore_errors=*}
      if [ ! -e "$file" ] && [ "$entry" = "$file (ignore_errors=yes)" ]; then continue; fi
      if [ ! -r "$file" ]; then doubt "the unit's EnvironmentFile $file can't be read"; continue; fi
      while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^[[:space:]]*([#\;].*)?$ ]] && continue # blank or comment
        if [[ "$line" =~ $plain ]]; then caddy_env+=("$line"); else doubt "the unit's EnvironmentFile $file has an entry that is not a plain KEY=value"; fi
      done <"$file"
    done < <(systemctl show -p EnvironmentFiles --value caddy 2>/dev/null | grep -oE '[^ ]+ \(ignore_errors=(yes|no)\)')
    caddy_reference=$(caddy_adapted root)
    if [ -z "$caddy_reference" ]; then
      doubt "caddy adapt could not read the Caddyfile with the service's environment"
    elif ! caddy_reads; then
      doubt "caddy as $caddy_user does not read the Caddyfile as root does even before any change, so it can't prove anything after"
    fi
  fi
}
caddy_adapted() { # <root|user>: what Caddy reads from the Caddyfile
  local as=()
  [ "$1" = root ] || as=(timeout 60 runuser -u "$caddy_user" --)
  (cd / && "${as[@]}" env -i "${caddy_env[@]}" "$caddy_bin" adapt --config "$CADDYFILE" --adapter caddyfile 2>/dev/null)
}
caddy_validates() {
  (cd / && timeout 60 runuser -u "$caddy_user" -- env -i "${caddy_env[@]}" "$caddy_bin" validate --config "$CADDYFILE" --adapter caddyfile) >/dev/null 2>&1
}
# `validate` alone is not enough: a glob that matches nothing, as when Caddy's user can't open the folder,
# is only a warning to it, so what it reads is compared too.
# Returns 1 when validate fails, 2 when what Caddy reads differs.
caddy_reads() { caddy_validates || return 1; [ "$(caddy_adapted user)" = "$caddy_reference" ] || return 2; }

closed_now=() # "<folder> <old mode>", closed in this run and not yet proven safe
caddy_proven=yes
# What the deploy's annotations say at the end, every run (the first production run's output showed neither
# the state of each folder nor whether Caddy's own check ran, #1075): each guarded folder's state, and Caddy's
# check. A folder not closed because of a doubt has its own warning above.
states=()
caddy_note="not needed: no guarded folder was open to others"
# Puts the old modes back, and says which could not be. Also runs when the script stops before the proof is
# done, however it stops (bash runs the EXIT trap on a fatal signal too).
restore_modes() {
  local entry
  restore_failed=()
  [ "$caddy_proven" = yes ] && return
  for entry in "${closed_now[@]}"; do chmod "${entry##* }" "${entry% *}" || restore_failed+=("${entry% *} (old mode ${entry##* })"); done
  [ "${#restore_failed[@]}" = 0 ] || report "WARNING: preview host guards: these modes could not be put back: ${restore_failed[*]}"
}
trap restore_modes EXIT

for dir in "$production" "$BACKUP_ROOT" "$UMAMI_DIR" "$PRODUCTION_PM2_LOG_DIR"; do
  [ -e "$dir" ] || [ -L "$dir" ] || { states+=("$dir: not there"); continue; } # not installed here: nothing to protect
  if [ -L "$dir" ] || [ ! -d "$dir" ]; then
    warn "$dir is a link or not a folder"
  elif [ -n "$(find "$dir" -maxdepth 1 ! -uid "$ROOT_UID" -print -quit)" ]; then # the folder itself, or an entry in it
    warn "$dir or something directly in it is not owned by root, so something else may need the access"
  elif reason=$(folder_needed "$dir"); [ -n "$reason" ]; then
    warn "$dir is not closed: $reason"
  else
    mode=$(stat -c %a "$dir")
    ((8#$mode & 8#007)) || { states+=("$dir: already closed (mode $mode)"); continue; }
    [ -n "$caddy_prepared" ] || prepare_caddy_proof
    if [ -n "$caddy_doubt" ]; then
      warn "$dir is not closed: $caddy_doubt"
      caddy_note="not run: $caddy_doubt"
      continue
    fi
    caddy_proven=no
    report "Preview host guards: closing $dir (old mode $mode; undo: chmod $mode $dir)"
    chmod o-rwx "$dir" || { warn "chmod failed on $dir"; continue; }
    closed_now+=("$dir $mode")
  fi
done

if [ "${#closed_now[@]}" != 0 ]; then
  caddy_reads
  caddy_failed=$?
  if [ "$caddy_failed" = 0 ]; then
    caddy_proven=yes
    for entry in "${closed_now[@]}"; do
      changes+=("${entry% *}: mode ${entry##* } -> $(stat -c %a "${entry% *}") (undo: chmod ${entry##* } ${entry% *})")
      states+=("${entry% *}: closed now (was ${entry##* })")
    done
    caddy_note="ran as $caddy_user, before and after: validate passed and it read the Caddyfile as root does"
  else
    restore_modes
    for entry in "${closed_now[@]}"; do states+=("${entry% *}: left as it was"); done
    caddy_note="ran as $caddy_user and FAILED, so every mode was put back"
    caddy_proven=yes
    if [ "${#restore_failed[@]}" = 0 ]; then restored="so every mode changed in this run was put back"; else restored="and these modes could not be put back: ${restore_failed[*]}"; fi
    if [ "$caddy_failed" = 1 ]; then why="made caddy validate fail as its own user (an imported file, a log or certificate file, or the Caddyfile itself is in a closed folder)"
    else why="changed what Caddy reads, as its own user, from the Caddyfile (a glob or link into a closed folder matches nothing without an error)"; fi
    warn "closing the folders $why, $restored"
  fi
fi

# ---- 2. cron and at. ----

# True when <file> has a line that is exactly the account's name.
lists_account() { grep -qxF -- "$PREVIEW_USER" "$1" 2>/dev/null; }
# Adds the account to a deny file that is a plain root-owned file nobody else can write, with a dated copy
# of the old one. Creates it only when <create> is yes.
deny_scheduler() { # <name> <deny file> <create: yes|no>
  local file="$2"
  if [ -L "$file" ] || { [ -e "$file" ] && [ ! -f "$file" ]; }; then warn "$file is a link or not a file"; return; fi
  if [ -e "$file" ]; then
    if ! root_only_writable "$file"; then
      warn "$file is not root-owned or can be written by others"
      return
    fi
    ! lists_account "$file" || return 0
    cp -p "$file" "$file.bak-preview-guards-$stamp" || { warn "could not copy $file first"; return; }
    # the name goes on a line of its own, also when the last line has no newline
    { [ -z "$(tail -c1 "$file")" ] || echo; printf '%s\n' "$PREVIEW_USER"; } | tee -a "$file" >/dev/null || { warn "could not write $file"; return; }
  elif [ "$3" = yes ]; then
    (umask 022 && printf '%s\n' "$PREVIEW_USER" | tee "$file" >/dev/null) || { warn "could not write $file"; return; }
  else
    return 0
  fi
  changes+=("$1: $PREVIEW_USER added to $file")
}
# Not allowed to use the scheduler: an allow file that doesn't list it, or a deny file that does; with
# neither file, what <none> says (cron lets everyone use it, at only root).
scheduler_denied() { # <allow file> <deny file> <none: yes|no>
  if [ -e "$1" ]; then ! lists_account "$1"; elif [ -e "$2" ]; then lists_account "$2"; else [ "$3" = yes ]; fi
}
if lists_account "$CRON_ALLOW" || lists_account "$AT_ALLOW"; then
  warn "$PREVIEW_USER is in an allow file for cron or at"
else
  deny_scheduler cron "$CRON_DENY" yes
  deny_scheduler at "$AT_DENY" no
  scheduler_denied "$CRON_ALLOW" "$CRON_DENY" no || warn "cron would still run jobs for $PREVIEW_USER"
  scheduler_denied "$AT_ALLOW" "$AT_DENY" yes || warn "at would still run jobs for $PREVIEW_USER"
fi

# ---- 3. The firewall rule and its unit. ----

firewall() {
  local tool uid unit_text tmp unit_name
  for tool in iptables ip6tables systemctl; do
    command -v "$tool" >/dev/null 2>&1 || { warn "$tool was not found"; return; }
  done
  uid=$(id -u "$PREVIEW_USER" 2>/dev/null) && [[ "$uid" =~ ^[1-9][0-9]*$ ]] || { warn "the account $PREVIEW_USER does not exist"; return; }
  # Only when Caddy's admin endpoint is where the rule looks. If root can't connect, it is elsewhere (or
  # Caddy is down) and a rule here would protect nothing and could not be checked.
  ! port_is_free "$CADDY_ADMIN_PORT" || { warn "Caddy's admin endpoint does not answer on 127.0.0.1 port $CADDY_ADMIN_PORT"; return; }
  [ ! -L "$UNIT_FILE" ] || { warn "$UNIT_FILE is a link"; return; }
  [ ! -e "$UNIT_FILE" ] || grep -qF "$MARKER" "$UNIT_FILE" || { warn "$UNIT_FILE exists and this script did not write it"; return; }
  unit_text="# $MARKER. Changes here are overwritten on deploy.
[Unit]
Description=Keep the pull request preview account away from Caddy's admin endpoint
After=network-pre.target ufw.service nftables.service docker.service
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash $PREVIEW_ACCESS_DIR/ops/preview-host-guards.sh boot

[Install]
WantedBy=multi-user.target"
  apply_rule "$uid" || { warn "an iptables rule could not be added"; return; }
  unit_name=$(basename "$UNIT_FILE")
  if ! printf '%s\n' "$unit_text" | cmp -s - "$UNIT_FILE" 2>/dev/null; then
    tmp=$(mktemp "$UNIT_FILE.new-XXXXXX") || { warn "could not make the unit file"; return; }
    printf '%s\n' "$unit_text" >"$tmp" && chmod 644 "$tmp" || { rm -f "$tmp"; warn "could not write the unit file"; return; }
    if [ -e "$UNIT_FILE" ]; then cp -p "$UNIT_FILE" "$UNIT_FILE.bak-preview-guards-$stamp" || { rm -f "$tmp"; warn "could not copy the unit file first"; return; }; fi
    mv -f "$tmp" "$UNIT_FILE" || { rm -f "$tmp"; warn "could not put the unit file in place"; return; }
    changes+=("boot unit $UNIT_FILE written")
    systemctl daemon-reload || { warn "systemd would not reload its units"; return; }
  fi
  # Enabled whenever it is not, so an enable that failed once is tried again on the next deploy.
  if ! systemctl is-enabled --quiet "$unit_name" 2>/dev/null; then
    systemctl enable "$unit_name" >/dev/null 2>&1 || { warn "systemd would not enable the boot unit, so the rule is lost at the next reboot"; return; }
    changes+=("boot unit $unit_name enabled")
  fi
}
firewall

report "Preview host guards: ${states[*]:+$(IFS=';'; echo "${states[*]}")}${states[*]:+ | }Caddy's own check: $caddy_note"
if [ "${#changes[@]}" = 0 ]; then
  [ "$status" != 0 ] || report "Preview host guards already in place: production's folders, cron and at, Caddy's admin endpoint"
else
  printf '%s\n' "Preview host guards (a replaced file is kept as <file>.bak-preview-guards-$stamp):" "${changes[@]/#/- }" | report_lines notice Server
fi
exit "$status"
