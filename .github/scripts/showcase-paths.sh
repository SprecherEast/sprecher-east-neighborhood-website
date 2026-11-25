# shellcheck shell=bash
# The one list of files that change the component showcase (#1459): a story, a shared component the showcase
# draws, the theme it draws them in, and the showcase's own settings and build. Sourced by plan-preview.sh,
# which asks it whether a pull request preview also gets the showcase built (the production deploy builds
# the showcase on every deploy and does not read this list).

# True (0) when a change to <path> changes the showcase; false (1) when it doesn't.
changes_showcase() { # <path relative to the repository root>
  case "$1" in
    # Notes and tests are not part of what the showcase draws, wherever they sit.
    *.md | *.test.ts | *.test.tsx) return 1 ;;
    *.stories.ts | *.stories.tsx) return 0 ;;
    src/platform/ui/* | src/platform/richtext/* | src/platform/theme/* | src/themes/*) return 0 ;;
    "src/app/(frontend)/globals.css") return 0 ;;
    .storybook/* | ops/build-showcase.sh | package.json | package-lock.json) return 0 ;;
    *) return 1 ;;
  esac
}
