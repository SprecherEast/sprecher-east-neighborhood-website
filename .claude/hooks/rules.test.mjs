import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { markReminded, remindedNotes } from './io.mjs'
import {
  inspect,
  knowledgeReminder,
  parseCommands,
  readCommit,
  shouldFormat,
  shouldLint,
} from './rules.mjs'

const reason = (command) => inspect(command).reason

describe('parseCommands', () => {
  it('splits at operators and removes quotes', () => {
    expect(parseCommands(`git add -A && git commit -m "a; b" | cat`)).toEqual([
      ['git', 'add', '-A'],
      ['git', 'commit', '-m', 'a; b'],
      ['cat'],
    ])
  })
})

describe('forbidden commands', () => {
  it.each([
    'gh pr merge 12 --squash --admin',
    'gh pr merge --admin 12',
    'gh api -X PUT repos/o/r/pulls/1/merge-async -f bypass_rules=true',
    `echo '{"bypass_rules": true}' | gh api repos/o/r/pulls/1/merge --input -`,
    'git push origin main',
    'git push origin +main',
    'git push -f origin HEAD:main',
    'git push origin main:main',
    'git push origin HEAD:refs/heads/main',
    'git push origin :main',
    'git push --delete origin main',
    'git push origin "main"',
    "git push origin 'main'",
    'git -C ../wt push origin main',
    'cd x && git push origin master',
  ])('refuses %s', (command) => {
    expect(reason(command)).toMatch(/AGENTS\.md/)
  })

  it.each([
    'gh pr merge 12 --squash',
    'gh api -X PUT repos/o/r/pulls/1/merge-async -F bypass_rules=false',
    'git push origin agent/C-Builder/446-hooks',
    'git push origin feature/main',
    'git push origin fix-main-menu',
    'git push --force-with-lease origin HEAD',
    'git fetch origin main',
    'git rebase origin/main',
    'git checkout --detach origin/main',
    'git commit -m "never run gh pr merge --admin or push to main"',
  ])('allows %s', (command) => {
    expect(reason(command)).toBeNull()
  })

  it('leaves a push that names no branch to the caller, which checks the current one', () => {
    expect(inspect('git push').barePush).toBe(true)
    expect(inspect('git push -u origin').barePush).toBe(true)
    expect(inspect('git push origin HEAD').barePush).toBe(false)
  })
})

describe('readCommit', () => {
  it('sees when the commit stages everything itself', () => {
    expect(readCommit(['-am', 'x']).all).toBe(true)
    expect(readCommit(['-a', '-m', 'x']).all).toBe(true)
    expect(readCommit(['--all', '-m', 'x']).all).toBe(true)
  })

  it('reads a message as a message', () => {
    expect(readCommit(['-m', 'fix -a flag']).all).toBe(false)
    expect(readCommit(['-m', '-a']).all).toBe(false)
    expect(readCommit(['--message', 'all']).all).toBe(false)
  })

  it('is found through `git -C`', () => {
    expect(inspect('git -C ../wt commit -am x').commits).toEqual([{ all: true }])
  })
})

describe('file filters', () => {
  it('formats source and docs, lints only code', () => {
    expect(shouldFormat('src/a.tsx')).toBe(true)
    expect(shouldFormat('docs/a.md')).toBe(true)
    expect(shouldFormat('public/a.png')).toBe(false)
    expect(shouldLint('src/a.ts')).toBe(true)
    expect(shouldLint('docs/a.md')).toBe(false)
  })
})

describe('knowledge reminder', () => {
  const mapJson = JSON.stringify([
    { note: 'src/modules/events/README.md', paths: ['src/modules/events/**'] },
  ])
  const remind = (file, options = {}) =>
    knowledgeReminder({
      file,
      mapJson,
      reminded: new Set(),
      noteChanged: () => false,
      ...options,
    })

  it('reminds when a mapped file is edited and its note is unchanged', () => {
    const found = remind('src/modules/events/domain/upcoming.ts')
    expect(found.note).toBe('src/modules/events/README.md')
    expect(found.message).toMatch(/src\/modules\/events\/README\.md/)
    expect(found.message).toMatch(/Behavior change: none/)
  })

  it('stays quiet when the note changed, it is the note, or the file is a test or unmapped', () => {
    const file = 'src/modules/events/domain/upcoming.ts'
    expect(remind(file, { noteChanged: () => true })).toBeNull()
    expect(remind('src/modules/events/README.md')).toBeNull()
    expect(remind('src/modules/events/domain/upcoming.test.ts')).toBeNull()
    expect(remind('src/modules/news/domain/x.ts')).toBeNull()
  })

  it('reminds once per module: not again for a note already reminded', () => {
    const reminded = new Set(['src/modules/events/README.md'])
    expect(remind('src/modules/events/ui/Card.tsx', { reminded })).toBeNull()
  })

  it('throws on a map it cannot read, for the hook to ignore', () => {
    expect(() => remind('src/a.ts', { mapJson: '{' })).toThrow()
  })
})

describe('reminders kept per session', () => {
  let dir
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  it('remembers a note for the same session only', () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'reminded-'))
    expect(remindedNotes('s1', dir).size).toBe(0)
    markReminded('s1', 'a.md', dir)
    markReminded('s1', 'b.md', dir)
    expect([...remindedNotes('s1', dir)]).toEqual(['a.md', 'b.md'])
    expect(remindedNotes('s2', dir).size).toBe(0)
  })
})

describe('after-edit hook, end to end', () => {
  let dir
  let stateDir
  afterEach(() => {
    for (const d of [dir, stateDir]) if (d) rmSync(d, { recursive: true, force: true })
  })

  const run = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  const hook = path.resolve('.claude/hooks/after-edit.mjs')
  const edit = (file, session) =>
    spawnSync(process.execPath, [hook], {
      cwd: dir,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: dir, session_id: session, tool_input: { file_path: file } }),
      env: { ...process.env, TMPDIR: stateDir },
    })

  /** A repository with a map, a note and a code file on main, and a branch off it */
  const setup = () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'hook-'))
    stateDir = mkdtempSync(path.join(os.tmpdir(), 'hook-state-'))
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 'a@b.c')
    run('config', 'user.name', 'T')
    mkdirSync(path.join(dir, 'docs/knowledge'), { recursive: true })
    mkdirSync(path.join(dir, 'src/modules/events'), { recursive: true })
    writeFileSync(
      path.join(dir, 'docs/knowledge/map.json'),
      JSON.stringify([{ note: 'src/modules/events/README.md', paths: ['src/modules/events/**'] }]),
    )
    writeFileSync(path.join(dir, 'src/modules/events/README.md'), '# Events\n')
    writeFileSync(path.join(dir, 'src/modules/events/a.ts'), 'export const a = 1\n')
    run('add', '-A')
    run('commit', '-q', '-m', 'init')
    run('checkout', '-q', '-b', 'work')
  }

  it('prints the reminder once per session and never blocks', () => {
    setup()
    const file = path.join(dir, 'src/modules/events/a.ts')
    writeFileSync(file, 'export const a = 2\n')
    const first = edit(file, 'sess-1')
    expect(first.status).toBe(0)
    expect(JSON.parse(first.stdout).hookSpecificOutput.additionalContext).toMatch(
      /src\/modules\/events\/README\.md/,
    )
    const second = edit(file, 'sess-1')
    expect(second.status).toBe(0)
    expect(second.stdout).toBe('')
  })

  it('prints nothing when the note changed compared with main', () => {
    setup()
    writeFileSync(path.join(dir, 'src/modules/events/README.md'), '# Events\n\nA new rule.\n')
    const file = path.join(dir, 'src/modules/events/a.ts')
    writeFileSync(file, 'export const a = 2\n')
    const result = edit(file, 'sess-2')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })
})
