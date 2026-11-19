#!/usr/bin/env bash
# Decides whether the deploy may go out with the server's Turnstile keys (#869). Writes `turnstile_paired`
# (yes|no) to $GITHUB_OUTPUT: yes when both keys are set, no when the owner chose to deploy
# without a robot check.
#
# Both keys: deploy. Only one: stop (a half-set pair blocks visitors or shows a check the server
# never enforces). Neither: stop, unless ALLOW_NO_ROBOT_CHECK is `true`, the repository variable
# that is the visible opt-out; the deploy then runs and warns on its page every time. Only the
# keys' presence is checked, not that Cloudflare accepts them. Local development and the
# end-to-end tests never run this: they don't go through the deploy workflow.
#
# Environment: SITE_KEY (may be empty), SECRET_SET (yes|no), ALLOW_NO_ROBOT_CHECK (may be empty),
# GITHUB_OUTPUT.
set -euo pipefail

: "${GITHUB_OUTPUT:?}"
SITE_KEY="${SITE_KEY:-}"
SECRET_SET="${SECRET_SET:-no}"
ALLOW_NO_ROBOT_CHECK="${ALLOW_NO_ROBOT_CHECK:-}"

if [ -n "$SITE_KEY" ] && [ "$SECRET_SET" = yes ]; then
  paired=yes
  if [ "$ALLOW_NO_ROBOT_CHECK" = true ]; then
    echo "::notice title=Robot check::both keys are set, so ALLOW_NO_ROBOT_CHECK has no effect; remove the variable"
  fi
elif [ -n "$SITE_KEY" ] || [ "$SECRET_SET" = yes ]; then
  echo "::error title=Robot check::only one of the two Turnstile keys is set in .env.local; set both (NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY)"
  exit 1
elif [ "$ALLOW_NO_ROBOT_CHECK" = true ]; then
  paired=no
  echo "::warning title=Robot check::deploying WITHOUT a robot check: neither Turnstile key is set and the ALLOW_NO_ROBOT_CHECK repository variable is true. Contact messages and sign-ups still wait for email confirmation."
else
  echo "::error title=Robot check::neither Turnstile key is set in .env.local, so the contact form and sign-up would run without a robot check. Add both keys on the server, or, as the owner's decision, set the repository variable ALLOW_NO_ROBOT_CHECK to true to deploy without one (Settings → Secrets and variables → Actions → Variables)."
  exit 1
fi
echo "turnstile_paired=$paired" >>"$GITHUB_OUTPUT"
