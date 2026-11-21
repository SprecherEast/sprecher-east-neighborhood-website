#!/usr/bin/env bash
# Asks the server what a pull request preview's build needs to know (#1075): runs the wrapper's `facts`
# action as the restricted preview account (ops/preview-wrapper.sh) and writes `available` (yes|no) and
# `node` (the server's Node version) to $GITHUB_OUTPUT. Run by a job in the `preview` environment, from
# main's copy of the scripts, after `ssh vps` was set up by .github/actions/vps-ssh.
#
# Previews are unavailable, and the workflow ends green without a retry, when:
#   - the environment doesn't hold every connection value yet (VALUES_SET is not true), or
#   - the server doesn't accept the key. The production deploy writes the key's line only after the host
#     guards and the isolation check passed (ops/install-preview-access.sh), so a refusal here is how
#     "no key line" shows up from outside: ssh ends with 255 for a connection or sign-in failure.
# Anything else that fails is an error. ssh's own messages are not printed: they can name the host.
#
# Environment: VALUES_SET (true|false), GITHUB_OUTPUT.
set -euo pipefail

: "${GITHUB_OUTPUT:?}"

unavailable() { # <reason>
  echo "available=no" >>"$GITHUB_OUTPUT"
  echo "::notice title=Pull request preview::Previews are unavailable: $1. Nothing was built or retried."
  exit 0
}

[ "${VALUES_SET:-false}" = true ] ||
  unavailable "the \`preview\` environment doesn't hold the preview key and connection values yet"

status=0
facts=$(ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps facts 2>/dev/null) || status=$?
[ "$status" -ne 255 ] ||
  unavailable "the server did not accept the preview key (the production deploy writes the key's line only when the host guards and the isolation check pass)"
if [ "$status" -ne 0 ]; then
  echo "::error title=Pull request preview::the server refused the facts request"
  exit 1
fi

node=$(sed -n 's/^node=//p' <<<"$facts" | tail -n 1)
if ! [[ "$node" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error title=Pull request preview::unexpected Node version from the server"
  exit 1
fi
{
  echo "available=yes"
  echo "node=$node"
} >>"$GITHUB_OUTPUT"
echo "::notice title=Pull request preview::the server runs Node $node"
