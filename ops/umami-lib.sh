# shellcheck shell=bash
# What the Umami scripts share (#948): install-umami.sh and backup-umami.sh source it after
# lib.sh, and the other umami-*.sh files are sourced by install-umami.sh. One definition each.

UMAMI_DIR="${UMAMI_DIR:-/var/www/umami}"
UMAMI_PORT="${UMAMI_PORT:-3100}" # written to .env for compose, filled into the Caddy block, checked by deploy.yml
UMAMI_CADDY_FILE="${UMAMI_CADDY_FILE:-/etc/caddy/sprecher-east-umami.caddy}"

umami_compose() { docker compose -f "$UMAMI_DIR/compose.yaml" --project-directory "$UMAMI_DIR" "$@"; }

# True when the containers (or the named service) are running.
umami_running() { [ -n "$({ umami_compose ps --status running -q "$@" 2>/dev/null || true; } | head -n 1)" ]; }
