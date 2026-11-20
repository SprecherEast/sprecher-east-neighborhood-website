# shellcheck shell=bash
# One lock for every script that changes Caddy's files or reloads it (#1345): caddy-limits.sh,
# caddy-https.sh, caddy-previews.sh, the Umami route changes and the preview block script. The preview
# account can run the last one at any moment (through its sudo rule), so without a shared lock it could
# reload Caddy in the middle of a production script's change, validation or rollback. The lock file
# sits beside the Caddyfile, a folder only root writes, so the preview account can neither create nor
# hold it. Sourced after lib.sh; the lock is held until the script ends (file descriptor 8).

# Takes the lock, waiting up to CADDY_LOCK_WAIT seconds (default 300). Returns 1 when it could not.
take_caddy_lock() {
  local file="${CADDY_LOCK_FILE:-$(dirname "$CADDYFILE")/.sprecher-east-caddy.lock}"
  # The redirection in a group so a file that can't be opened returns 1 instead of ending the script.
  { exec 8>>"$file"; } 2>/dev/null || return 1
  flock -w "${CADDY_LOCK_WAIT:-300}" 8
}
