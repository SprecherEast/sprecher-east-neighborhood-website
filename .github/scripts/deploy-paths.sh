# shellcheck shell=bash
# The one list of files that don't run on the server (#245, #1075): docs and repository tooling. Sourced
# by plan-deploy.sh (does a push to main deploy?) and plan-preview.sh (does a pull request get a preview?),
# so the two can't drift apart.

# True (0) when a change to <path> reaches the server and so needs a deploy; false (1) when it doesn't.
deploys_for_file() { # <path relative to the repository root>
  case "$1" in
    *.md | .claude/* | .agents/* | .github/* | .env.local.example | docs/* | LICENSE) return 1 ;;
    *) return 0 ;;
  esac
}
