# shellcheck shell=bash
# The one way the ops scripts make and recognise a generated secret (#1344). Sourced, not run.
# A generated secret is 64 hex characters (safe in a file and a URL); a command that fails to make
# one fails here, so an empty secret is never written.

# True when <value> has the shape of a generated secret.
is_secret() { [[ "$1" =~ ^[0-9a-f]{64}$ ]]; }

# A new random secret on stdout, or a non-zero exit and nothing printed.
new_secret() {
  local value
  value=$(openssl rand -hex 32 2>/dev/null || true)
  is_secret "$value" || return 1
  printf '%s' "$value"
}
