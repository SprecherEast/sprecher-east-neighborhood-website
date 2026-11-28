// The generated rules are not in git (#1593), so they have to exist before first use: in a fresh
// clone and in a worktree, built by the session-start hook with no packages installed.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { GENERATED_DIR } from '../../scripts/agent-context-rules.mjs'
import { checkoutsFor, ensureGeneratedRules } from './generated-rules.mjs'

const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hook = path.join(repoDir, '.claude/hooks/session-start.mjs')

const FILES = {
  'CLAUDE.md': '# Adapter\n',
  'docs/guidelines/README.md':
    '| Reference | Loads by itself when the work touches |\n| - | - |\n' +
    '| [Mod rules](mod.md) | `src/mod/**` |\n',
  'docs/guidelines/mod.md': '# Mod rules\n\nSee [x](../x.md).\n',
  'src/mod/code.ts': 'export {}\n',
  '.gitignore': '/.claude/rules/generated/\n',
}
const RULE = `${GENERATED_DIR}/docs--guidelines--mod.md`

const dirs = []
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))
const temp = (name) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `generated-rules-${name}-`))
  dirs.push(dir)
  return dir
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

/** A source repository with one commit, as a clone and a worktree are made from. */
function source() {
  const root = temp('source')
  for (const [file, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '-A')
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init')
  return root
}

const hasRule = (root) => fs.existsSync(path.join(root, RULE))

describe('the generated rules in a fresh clone', () => {
  it('are missing after the clone, and built by the session-start hook', () => {
    const clone = path.join(temp('clone-parent'), 'clone')
    git(os.tmpdir(), 'clone', '-q', source(), clone)
    expect(hasRule(clone)).toBe(false)

    const result = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ cwd: clone }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: clone },
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).hookSpecificOutput.hookEventName).toBe('SessionStart')
    const text = fs.readFileSync(path.join(clone, RULE), 'utf8')
    expect(text).toContain("paths:\n  - 'src/mod/**'")
    expect(text).toContain('](/docs/x.md)')
    expect(git(clone, 'status', '--porcelain')).toBe('')
  })
})

describe('the generated rules in a worktree', () => {
  it('are built for the worktree the session works in, even when the project directory is the main checkout', () => {
    const main = source()
    const worktree = path.join(temp('worktree-parent'), 'wt')
    git(main, 'worktree', 'add', '-q', '-b', 'work', worktree)
    expect(hasRule(worktree)).toBe(false)

    const result = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ cwd: path.join(worktree, 'src') }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: main },
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(hasRule(worktree)).toBe(true)
    expect(hasRule(main)).toBe(true)
    expect(git(worktree, 'status', '--porcelain')).toBe('')
  })

  it('are built when the project directory is the worktree itself', () => {
    const main = source()
    const worktree = path.join(temp('worktree-parent'), 'wt')
    git(main, 'worktree', 'add', '-q', '-b', 'work', worktree)
    expect(ensureGeneratedRules(worktree, undefined)).toEqual([path.resolve(worktree)])
    expect(hasRule(worktree)).toBe(true)
  })
})

describe('ensureGeneratedRules', () => {
  it('rebuilds a rule that went stale after a pull, and leaves a current one untouched', () => {
    const root = source()
    ensureGeneratedRules(root)
    const file = path.join(root, RULE)
    const before = fs.statSync(file).mtimeMs
    ensureGeneratedRules(root)
    expect(fs.statSync(file).mtimeMs).toBe(before)

    fs.writeFileSync(path.join(root, 'docs/guidelines/mod.md'), '# Mod rules\n\nChanged.\n')
    ensureGeneratedRules(root)
    expect(fs.readFileSync(file, 'utf8')).toContain('Changed.')
  })

  it('skips a directory that is not a checkout of this project, and never throws', () => {
    const elsewhere = temp('elsewhere')
    expect(checkoutsFor(elsewhere, elsewhere)).toEqual([])
    expect(ensureGeneratedRules(elsewhere, elsewhere)).toEqual([])
    expect(ensureGeneratedRules(undefined, undefined)).toEqual([])
  })

  it('names each checkout once', () => {
    const root = source()
    expect(checkoutsFor(root, path.join(root, 'src'))).toEqual([path.resolve(root)])
  })
})

describe('the folder in this repository', () => {
  it('is ignored by git and holds nothing git tracks', () => {
    expect(git(repoDir, 'ls-files', GENERATED_DIR).trim()).toBe('')
    expect(git(repoDir, 'check-ignore', `${GENERATED_DIR}/x.md`).trim()).toBe(
      `${GENERATED_DIR}/x.md`,
    )
  })

  it('is built by the session-start hook the settings name', () => {
    const settings = JSON.parse(
      fs.readFileSync(path.join(repoDir, '.claude/settings.json'), 'utf8'),
    )
    const commands = settings.hooks.SessionStart.flatMap((entry) =>
      entry.hooks.map((h) => h.command),
    )
    expect(commands.some((command) => command.includes('.claude/hooks/session-start.mjs'))).toBe(
      true,
    )
  })
})
