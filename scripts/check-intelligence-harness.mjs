import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The one harness for the tests that change a copy of intelligence/ and run the check on it
// (scripts/check-intelligence.test.mjs, scripts/check-intelligence-evals.test.mjs, and the runner's
// tests of the settings): the vitest and node:test suites both import it from here.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'intelligence')

// Every copy goes when its test file ends (`removeCopies` in `afterAll`) or the test process does,
// so a run leaves nothing in the temporary folder
const copies = new Set()
/** Removes the copies made so far. */
export function removeCopies() {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true })
  copies.clear()
}
process.once('exit', removeCopies)

/**
 * A copy of intelligence/ without the runner. `changes` maps a path inside it to the text to
 * write, or to a function from the file's current text to the new text.
 */
export function copyIntelligence(changes = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'intelligence-'))
  copies.add(dir)
  cpSync(source, dir, {
    recursive: true,
    filter: (file) => !/^(runner|node_modules)(\/|$)/.test(path.relative(source, file)),
  })
  for (const [file, change] of Object.entries(changes)) {
    const target = path.join(dir, file)
    const text = typeof change === 'function' ? change(readFileSync(target, 'utf8')) : change
    writeFileSync(target, text)
  }
  return dir
}

/** `scripts/check-intelligence.mjs` run on `dir`: `{ status, stdout, stderr }`. */
export const runCheck = (dir) =>
  spawnSync(process.execPath, [path.join(root, 'scripts/check-intelligence.mjs'), dir], {
    cwd: root,
    encoding: 'utf8',
  })
