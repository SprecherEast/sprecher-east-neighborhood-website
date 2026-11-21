# shellcheck shell=bash
# Helpers shared by the scripts of the restricted preview account (#1345): the forced-command wrapper
# (preview-wrapper.sh), the Caddy script it reaches through sudo (preview-caddy.sh) and the installer.
# Sourced, not run. The first two run from PREVIEW_ACCESS_DIR, a root-owned copy made from main, and
# take their input from an SSH client that holds an unreviewed pull request's power: every value is
# checked here before it reaches a path, a command or a file, and nothing is passed to a shell.

# What a refused request prints: a fixed text, never the request itself, because the deploy log is
# public and a pull request's text could carry workflow commands.
refuse() { # <fixed reason>
  echo "::error title=Preview access::refused: $1"
  exit 2
}

# Root's user id; a test run by someone else sets its own.
ROOT_UID="${PREVIEW_ACCESS_ROOT_UID:-0}"

# True when <bytes> more in <folder>'s filesystem still leaves production's floor of free space (PREVIEW_FREE_FLOOR_KB,
# environment.sh: the number the production deploy's preflight requires). The one definition of that rule (#1076, #1397).
enough_disk() { # <folder> <bytes about to be written>
  local free_kb
  free_kb=$(df -Pk "$1" | awk 'NR == 2 { print $4 }')
  [[ "$free_kb" =~ ^[0-9]+$ ]] || return 1
  [ $((free_kb - ($2 + 1023) / 1024)) -gt "$PREVIEW_FREE_FLOOR_KB" ]
}

# True when <path> is root's and nobody else can write it (not group, not others): the one definition of "root's,
# and only root can change it", used by the installer, the host guards and the root scripts.
root_only_writable() { # <path>
  local owner mode
  read -r owner mode <<<"$(stat -c '%u %a' -- "$1")" || return 1
  [ "$owner" = "$ROOT_UID" ] && (((8#$mode & 8#022) == 0))
}

# True for a program root may run on a caller's say-so: the file, where a link leads, and the folders holding
# either are root's and only root can write them.
trusted_tool() { # <path>
  local real part
  real=$(readlink -f -- "$1") || return 1
  [ -f "$real" ] && [ -x "$real" ] || return 1
  for part in "$real" "$(dirname "$real")" "$(dirname "$1")"; do
    root_only_writable "$part" || return 1
  done
}

# Prints the first node found in <colon-separated folders> or /usr/bin that passes trusted_tool, the same lookup
# for the installer and the root step, so a node the root step would refuse is caught when it is installed.
trusted_node() { # <colon-separated folders>
  local dirs dir
  IFS=: read -ra dirs <<<"$1"
  for dir in "${dirs[@]}" /usr/bin; do
    if [ -n "$dir" ] && trusted_tool "$dir/node"; then
      printf '%s' "$dir/node"
      return 0
    fi
  done
  return 1
}

# A root script trusts nothing from its caller's environment. sudo resets it (the rule says so); when run as root
# and one of these names is set anyway, stop rather than act on it.
refuse_environment_as_root() { # <names of variables that could redirect the script>
  [ "$(id -u)" = 0 ] || return 0
  local name
  for name in "$@"; do
    [ -z "${!name+x}" ] || refuse "the environment sets $name"
  done
}

# Loads environment.sh in its production form, which defines the patterns and defaults the checks
# below use. A script that acts on one preview calls use_preview next, which switches to that
# preview's names (folder, PM2 process, port, address, Caddy block), all derived from its number.
reset_environment() { # <the ops folder>
  # shellcheck source=environment.sh
  . "$1/environment.sh"
}

valid_preview_number() { [[ "${1-}" =~ $PREVIEW_NUMBER_PATTERN ]]; }
valid_commit() { [[ "${1-}" =~ $PREVIEW_COMMIT_PATTERN ]]; }

# Switches to the environment of one preview, after the number has been checked.
use_preview() { # <number> <the ops folder>
  valid_preview_number "$1" || refuse "not a pull request number"
  PREVIEW_NUMBER="$1"
  # shellcheck source=environment.sh
  . "$2/environment.sh"
}

# True when every symbolic link under <folder> resolves inside it. An unpacked release that links
# elsewhere (an absolute link to production's folder, or enough `..`) is never run.
links_stay_inside() { # <folder>
  local root resolved
  root=$(realpath -- "$1") || return 1
  while IFS= read -r -d '' resolved; do
    case "$resolved" in "$root"/*) ;; *) return 1 ;; esac
  done < <(find "$1" -type l -print0 | xargs -0 -r realpath -m -z --)
}

# Prints what an archive unpacks to: the sizes of every member in its listing, added up (#1346). GNU tar
# can't cap the unpacked size itself, and the sizes in the headers are what it writes. The listing uses
# numeric owners, so an owner name with a space can't shift the size field. A size can be claimed without
# data (a PAX sparse member lists its real size, up to 2^63), and shell arithmetic wraps around at 2^63, so
# a size with more digits than the limit is refused at once and the running total is checked against the
# limit after every member, so the sum stays far below 2^63. Returns 1, printing nothing, when
# the archive can't be listed, has no members or a line isn't a plain member line (a name with a newline
# makes one that isn't), and 2 when it is over the limit: an archive that can't be measured, or is too big,
# is never unpacked.
unpacked_bytes() { # <archive> <limit in bytes>
  local listing line size total=0 pattern
  pattern='^[-dlhbcps][-rwxsStT]{9}[+.]? [0-9]+/[0-9]+ +([0-9]+)(,[0-9]+)? '
  listing=$(tar --numeric-owner -tvzf "$1" 2>/dev/null) || return 1
  while IFS= read -r line; do
    [[ "$line" =~ $pattern ]] || return 1
    size=${BASH_REMATCH[1]}
    [ "${#size}" -le "${#2}" ] || return 2
    total=$((total + 10#$size))
    [ "$total" -le "$2" ] || return 2
  done <<<"$listing"
  echo "$total"
}
