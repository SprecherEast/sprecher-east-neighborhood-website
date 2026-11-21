# shellcheck shell=bash
# The runner's one way of reading the wrapper's `list` action (#1076): the call with its ssh options, the line
# format, and what to ask of a list. Sourced by preview-deploy.sh, preview-teardown.sh and preview-sweep.sh, so a
# change to the format (ops/preview-wrapper.sh, `list`) has one place to change here. Needs `ssh vps` set up.
#
# A line is `preview=<n> commit=<sha|none> idle=<seconds> folder=<yes|no> block=<yes|no> process=<online|stopped|none>`.
# A line that does not match is never guessed at: the caller stops, so an older wrapper's output (no fields) can
# not be read as "no previews" or as a reason to remove one.

LIST_LINE_PATTERN='^preview=([0-9]+) commit=([0-9a-f]{40}|none) idle=([0-9]+) folder=(yes|no) block=(yes|no) process=(online|stopped|none)$'

# Prints the server's list; fails when the server doesn't answer.
preview_list() {
  ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps list
}

# Splits one line into LIST_NUMBER, LIST_COMMIT, LIST_IDLE, LIST_FOLDER, LIST_BLOCK and LIST_PROCESS; fails when
# the line is not a list line.
parse_list_line() { # <line>
  [[ "$1" =~ $LIST_LINE_PATTERN ]] || return 1
  LIST_NUMBER=${BASH_REMATCH[1]}
  LIST_COMMIT=${BASH_REMATCH[2]}
  LIST_IDLE=${BASH_REMATCH[3]}
  LIST_FOLDER=${BASH_REMATCH[4]}
  LIST_BLOCK=${BASH_REMATCH[5]}
  LIST_PROCESS=${BASH_REMATCH[6]}
}

# Fails when any non-empty line of a listing is not a list line.
list_is_valid() { # <listing>
  local line
  while IFS= read -r line; do
    [ -z "$line" ] || parse_list_line "$line" || return 1
  done <<<"$1"
}

# Prints the line of this number, or nothing. The one loop over a listing.
list_line_of() { # <number> <listing>
  local line
  while IFS= read -r line; do
    if parse_list_line "$line" && [ "$LIST_NUMBER" = "$1" ]; then
      printf '%s\n' "$line"
      return 0
    fi
  done <<<"$2"
  return 0
}

# True when the listing has anything for this number: a folder, a block or a process.
list_holds() { # <number> <listing>
  [ -n "$(list_line_of "$1" "$2")" ]
}

# True when the listing has a folder for this number: a place under the cap, which the server counts by folder.
list_has_folder() { # <number> <listing>
  local line
  line=$(list_line_of "$1" "$2")
  [ -n "$line" ] && parse_list_line "$line" && [ "$LIST_FOLDER" = yes ]
}
