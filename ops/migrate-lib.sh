# shellcheck shell=bash
# `payload migrate` for the deploy (#1147), sourced by deploy-release.sh after lib.sh (it uses
# `report`).

# How long to wait before running `payload migrate` again after the database was busy, and how
# many runs it gets in all (#1147). The migration's own busy timeout
# (src/platform/payload/sqliteBusyTimeout.ts) has already waited before a run fails; this covers a
# lock that outlasts it.
MIGRATE_RETRY_SECONDS="${MIGRATE_RETRY_SECONDS:-5}"
MIGRATE_ATTEMPTS=2

# Runs `payload migrate` in a release folder (#1147). Runs again, within MIGRATE_ATTEMPTS, only
# when a run failed with SQLITE_BUSY and its output has no "Migrating:" line: it failed before any
# migration began (the case #1147 saw, on the first read), so nothing was applied. Once a migration
# has begun a failure is never retried: the site runs no database transactions, so the migration
# may be applied but not recorded, and would run twice. Any other failure, or the last run failing,
# returns 1 at once, so the caller stops the deploy with the live site unchanged. The output is
# shown as it comes (tee to stderr through `cat`, as /dev/stderr is not always openable) and kept in a variable, so no temp file is left. The status
# comes from a subshell with its own `pipefail`, never from the caller's settings.
run_migrate() { # <release folder>
  local release="$1" attempt status out
  for ((attempt = 1; attempt <= MIGRATE_ATTEMPTS; attempt++)); do
    status=0
    out=$(
      set -o pipefail
      cd "$release" && NODE_OPTIONS=--no-deprecation node_modules/.bin/payload migrate 2>&1 | tee >(cat >&2)
    ) || status=$?
    [ "$status" -ne 0 ] || return 0
    if [ "$attempt" -lt "$MIGRATE_ATTEMPTS" ] && [[ "$out" == *SQLITE_BUSY* && "$out" != *"Migrating: "* ]]; then
      report "WARNING: the database was busy before any migration began; trying once more in ${MIGRATE_RETRY_SECONDS}s"
      sleep "$MIGRATE_RETRY_SECONDS"
    else
      break
    fi
  done
  return 1
}
