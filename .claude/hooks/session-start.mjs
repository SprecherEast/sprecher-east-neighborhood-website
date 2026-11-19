#!/usr/bin/env node
// SessionStart hook (#1300): puts the process reminder in front of every session, so filing,
// claiming and the board do not depend on it being remembered. CI and the other hooks stay the gates.
import { SESSION_REMINDER } from './filing.mjs'

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: SESSION_REMINDER },
  }),
)
