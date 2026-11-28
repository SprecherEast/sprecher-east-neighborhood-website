/**
 * Builds the reference when it is not there (#1594). `docs/reference/` and the showcase's import map
 * are build output: ignored by git, made by `npm run docs:generate` (about 15 seconds). A fresh
 * clone, a new worktree and a CI job have neither, so every npm command that reads them runs this
 * first (the `pre…` hooks in package.json). When both are there it does nothing, so tests and the
 * dev server start at once; `--force` rebuilds, and `npm run docs:generate` always does.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { SHOWCASE_INDEX_FILE, SHOWCASE_REGISTRY_FILE } from './reference/showcaseRegistry.mjs'

/** What the app, the tests and the notes need: the showcase index and the import map made with it. */
export const OUTPUTS_NEEDED = [SHOWCASE_INDEX_FILE, SHOWCASE_REGISTRY_FILE]

/**
 * Builds the reference unless it is there. `exists` and `build` are injected so the decision is
 * testable; `build` returns the exit status of the build.
 */
export function ensureReference({ root, exists = fs.existsSync, build, force = false }) {
  const missing = OUTPUTS_NEEDED.map((file) => `${root}/${file}`).filter((file) => !exists(file))
  if (!force && missing.length === 0) return { built: false, status: 0 }
  return { built: true, status: build() }
}

const buildWithNpm = (root) => () => {
  console.log('Building the reference (npm run docs:generate, about 15 seconds)...')
  return spawnSync('npm', ['run', '--silent', 'docs:generate'], { cwd: root, stdio: 'inherit' })
    .status
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { status } = ensureReference({
    root,
    build: buildWithNpm(root),
    force: process.argv.includes('--force'),
  })
  process.exit(status ?? 1)
}
