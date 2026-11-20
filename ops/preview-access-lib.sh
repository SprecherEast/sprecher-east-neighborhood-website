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
# limit after every member: no sum is ever larger than twice the limit. Returns 1, printing nothing, when
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
