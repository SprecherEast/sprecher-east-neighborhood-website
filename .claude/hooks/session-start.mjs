#!/usr/bin/env node
// SessionStart hook (#1300): puts the process reminder in front of every session, so filing,
// claiming and the board do not depend on it being remembered. CI and the other hooks stay the gates.
// It also builds the generated rules, which are not in git (#1593).
import { ensureGeneratedRules } from './generated-rules.mjs'
import { SESSION_REMINDER } from './filing.mjs'
import { readInput } from './io.mjs'

ensureGeneratedRules(process.env.CLAUDE_PROJECT_DIR, readInput()?.cwd)

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: SESSION_REMINDER },
  }),
)
