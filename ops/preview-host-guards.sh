#!/usr/bin/env bash
# Keeps the pull request preview account away from the rest of the server (#1346). Run as root by
# ops/install-preview-access.sh on every production deploy, and once at boot by a systemd unit it installs
# (argument `boot`: only the firewall rule). It does three things, and each makes no change on any doubt,
# says so as a warning and leaves the others to go on:
#   1. production's private folders (its app folder, the backups, Umami's folder, PM2's log folder) lose
#      their access for "others": the production deploy runs with umask 022, so what it writes (the logs
#      too, under PM2) is readable by every account. A folder is closed only when all of this is true,
#      and otherwise left as it is, with a warning: it is a real folder, it and what is directly in it are
#      owned by root, Caddy's live configuration (`caddy adapt` of the Caddyfile, and the Caddyfile and the files
#      beside it, for what an import names) names no path in it, and
#      no process that isn't root's has it as its working folder or an open file in it. What this can't
#      see: a non-root service that opens a file there by name only from time to time. The old mode is in
#      the annotation, with the undo.
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
. "$here/umami-lib.sh"

ROOT_UID="${PREVIEW_ACCESS_ROOT_UID:-0}"
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
  local adapted proc uid ref target pattern
  adapted=$(caddy adapt --config "$CADDYFILE" --adapter caddyfile 2>/dev/null) && [[ "$adapted" == *[![:space:]]* ]] || { echo "caddy adapt could not read the live Caddyfile, so what Caddy serves or writes is unknown"; return; }
  if [[ "$adapted" == *"$1"/* || "$adapted" == *"$1\""* ]]; then echo "Caddy's configuration names a path in it"; return; fi
  # `caddy adapt` pastes an imported file's text in place, so the path of an import is not in what it prints:
  # the Caddyfile and every file beside it (the previews' blocks too) are read for the path as well.
  pattern=$(printf '%s' "$1" | sed 's/[][\\.*^$+?(){}|]/\\&/g')
  if [ -n "$(grep -rlEs -e "$pattern([^A-Za-z0-9_.-]|\$)" -- "$CADDYFILE" "${CADDYFILE%/*}" "$PREVIEW_CADDY_DIR")" ]; then
    echo "a file of Caddy's own configuration names a path in it (an import, say)"
    return
  fi
  for proc in "$PROC_DIR"/[0-9]*; do
    uid=$(awk '/^Uid:/ { print $3 }' "$proc/status" 2>/dev/null)
    [ -n "$uid" ] && [ "$uid" != "$ROOT_UID" ] || continue
    for ref in "$proc/cwd" "$proc"/fd/*; do
      target=$(readlink "$ref" 2>/dev/null) || continue
      case "$target" in "$1" | "$1"/*) echo "a process that isn't root's (pid ${proc##*/}) has it open"; return ;; esac
    done
  done
}

for dir in "$production" "$BACKUP_ROOT" "$UMAMI_DIR" "$PRODUCTION_PM2_LOG_DIR"; do
  [ -e "$dir" ] || [ -L "$dir" ] || continue # not installed here: nothing to protect
  if [ -L "$dir" ] || [ ! -d "$dir" ]; then
    warn "$dir is a link or not a folder"
  elif [ -n "$(find "$dir" -maxdepth 1 ! -uid "$ROOT_UID" -print -quit)" ]; then # the folder itself, or an entry in it
    warn "$dir or something directly in it is not owned by root, so something else may need the access"
  elif reason=$(folder_needed "$dir"); [ -n "$reason" ]; then
    warn "$dir is not closed: $reason"
  else
    mode=$(stat -c %a "$dir")
    if ((8#$mode & 8#007)); then
      chmod o-rwx "$dir" || { warn "chmod failed on $dir"; continue; }
      changes+=("$dir: mode $mode -> $(stat -c %a "$dir") (undo: chmod $mode $dir)")
    fi
  fi
done

# ---- 2. cron and at. ----

# True when <file> has a line that is exactly the account's name.
lists_account() { grep -qxF -- "$PREVIEW_USER" "$1" 2>/dev/null; }
# Adds the account to a deny file that is a plain root-owned file nobody else can write, with a dated copy
# of the old one. Creates it only when <create> is yes.
deny_scheduler() { # <name> <deny file> <create: yes|no>
  local file="$2"
  if [ -L "$file" ] || { [ -e "$file" ] && [ ! -f "$file" ]; }; then warn "$file is a link or not a file"; return; fi
  if [ -e "$file" ]; then
    if [ "$(stat -c %u "$file")" != "$ROOT_UID" ] || ((8#$(stat -c %a "$file") & 8#022)); then
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

if [ "${#changes[@]}" = 0 ]; then
  [ "$status" != 0 ] || report "Preview host guards already in place: production's folders, cron and at, Caddy's admin endpoint"
else
  printf '%s\n' "Preview host guards (a replaced file is kept as <file>.bak-preview-guards-$stamp):" "${changes[@]/#/- }" | report_lines notice Server
fi
exit "$status"
