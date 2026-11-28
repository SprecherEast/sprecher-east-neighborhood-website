/** The loader writes a note's rule without the area its `exclude` takes out (#1460). */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { run } from './agent-context.mjs'

const MAP = JSON.stringify([
  { note: 'src/mod/README.md', paths: ['src/mod/**'], exclude: ['src/mod/sub/**'] },
])
const FILES = {
  'docs/guidelines/README.md': '| Reference | Loads by itself when the work touches |\n| - | - |\n',
  'CLAUDE.md': '# Adapter\n',
  'docs/knowledge/map.json': MAP,
  'src/mod/README.md': '# Mod\n\nSee [x](../../docs/x.md).\n',
  'src/mod/code.ts': 'export {}\n',
  'src/mod/sub/other.ts': 'export {}\n',
  'src/mod/deep/inner/a.ts': 'export {}\n',
}
const RULE = '.claude/rules/generated/src--mod--README.md'

const roots = []
afterEach(() => roots.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-exclude-'))
  roots.push(root)
  for (const [file, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '-A'], { cwd: root })
  return root
}
// The fixture's load map is empty on purpose; that problem is not what this is about
const problemsOf = (root, options) =>
  run(root, options).problems.filter((problem) => !problem.includes('no load map'))

describe('a map entry with exclude', () => {
  it('writes the paths a note describes without its excluded area, then finds them current', () => {
    const root = repo()
    expect(problemsOf(root, { write: true })).toEqual([])
    const text = fs.readFileSync(path.join(root, RULE), 'utf8')
    expect(text).toContain("paths:\n  - 'src/mod/*'\n  - 'src/mod/deep/**'")
    expect(text).not.toContain('sub')
    expect(problemsOf(root)).toEqual([])
  })
})
