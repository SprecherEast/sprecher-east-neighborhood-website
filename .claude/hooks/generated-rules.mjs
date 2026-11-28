// Builds the generated rules where a session runs (#1593). They are build output, ignored by git,
// so a fresh clone and a worktree have none until this runs. It uses the package-free writer, so it
// needs no `npm ci`, and it never throws: a failure only means a rule loads late.
import fs from 'node:fs'
import path from 'node:path'

import { LOAD_MAP } from '../../scripts/agent-context-maps.mjs'
import { writeRules } from '../../scripts/agent-context-rules.mjs'
import { repoRoot } from './io.mjs'

/**
 * The checkouts that need the rules: the project directory Claude Code reports, and the checkout
 * the session works in when that is another one (a worktree), which the input's `cwd` names.
 */
export function checkoutsFor(projectDir, cwd) {
  const roots = [projectDir, cwd ? repoRoot(cwd) : null].filter(Boolean)
  return [...new Set(roots.map((dir) => path.resolve(dir)))].filter((dir) =>
    fs.existsSync(path.join(dir, LOAD_MAP)),
  )
}

/** Builds the rules in each checkout; returns the ones it built. */
export function ensureGeneratedRules(projectDir, cwd) {
  const built = []
  for (const root of checkoutsFor(projectDir, cwd)) {
    try {
      writeRules(root)
      built.push(root)
    } catch {
      // The session still starts; the rules load once `npm run agent-context -- --write` runs
    }
  }
  return built
}
