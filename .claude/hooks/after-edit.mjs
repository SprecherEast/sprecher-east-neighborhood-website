#!/usr/bin/env node
// PostToolUse hook on Edit, Write and MultiEdit (#446): formats the file Claude just changed and
// lints it, the same commands lint-staged runs at commit time, in the checkout (or worktree) that
// holds the file. A lint error goes back to Claude (exit 2) so it fixes it now, not at the commit.
// It never undoes the edit, and it does nothing before `npm install`. Then, once per module per
// session, it reminds when the edited file is one a knowledge note describes and that note is
// unchanged compared with main (#717), or else, once per session, when the file can change
// behavior anywhere in the repository and no doc has changed compared with main (#770). A reminder never blocks (exit 0); CI is the gate.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { KNOWLEDGE_MAP } from '../../scripts/agent-context-maps.mjs'
import {
  docChangedSinceMain,
  markReminded,
  noteChangedSinceMain,
  readInput,
  remindedNotes,
  repoRoot,
  runTool,
  stateDir,
} from './io.mjs'
import {
  BEHAVIOR_REMINDER_KEY,
  behaviorReminder,
  knowledgeReminder,
  shouldFormat,
  shouldLint,
} from './rules.mjs'

const input = readInput()
const file = input?.tool_input?.file_path
if (typeof file !== 'string' || !file) process.exit(0)

const absolute = path.resolve(input.cwd || process.cwd(), file)
const root = repoRoot(path.dirname(absolute))
if (!root) process.exit(0)
const relative = path.relative(root, absolute)
if (relative.startsWith('..') || relative.split(path.sep).includes('node_modules')) process.exit(0)

if (shouldFormat(relative)) runTool(root, 'prettier', ['--write', '--ignore-unknown', relative])

if (shouldLint(relative)) {
  const lint = runTool(root, 'eslint', ['--fix', '--no-warn-ignored', relative])
  if (lint && lint.status !== 0) {
    process.stderr.write(
      `ESLint found problems in ${relative}; fix them now:\n${lint.stdout}${lint.stderr}`,
    )
    process.exit(2)
  }
}

try {
  const session = input.session_id
  const state = session ? stateDir(root) : null
  const posix = relative.split(path.sep).join('/')
  const reminded = state ? remindedNotes(session, state) : new Set()
  const found =
    knowledgeReminder({
      file: posix,
      mapJson: readFileSync(path.join(root, KNOWLEDGE_MAP), 'utf8'),
      reminded,
      noteExists: (note) => existsSync(path.join(root, note)),
      noteChanged: (note) => noteChangedSinceMain(root, note),
    }) ?? behaviorReminder({ file: posix, reminded, docChanged: () => docChangedSinceMain(root) })
  if (found) {
    if (state) {
      markReminded(session, found.note, state)
      // A note reminder already says what the repository-wide one says
      markReminded(session, BEHAVIOR_REMINDER_KEY, state)
    }
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: found.message },
      }),
    )
  }
} catch {
  // No map, or one that doesn't parse: the reminder is optional
}
