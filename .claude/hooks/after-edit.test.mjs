// The after-edit hook run as Claude Code runs it, in a throwaway repository (#717)
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

describe('after-edit hook, end to end', () => {
  let dir
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  /** Runs git in the fixture and fails the test when git fails, so a setup error is never silent */
  const run = (...args) => {
    const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
    })
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`)
  }
  const hook = path.resolve('.claude/hooks/after-edit.mjs')
  const edit = (file, session) =>
    spawnSync(process.execPath, [hook], {
      cwd: dir,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: dir, session_id: session, tool_input: { file_path: file } }),
    })
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    writeFileSync(path.join(dir, file), text)
  }
  const MAP = JSON.stringify([
    { note: 'src/modules/events/README.md', paths: ['src/modules/events/**'] },
  ])

  /**
   * A repository with a map, a code file and (unless told otherwise) a note, committed on the
   * default branch, then a work branch off it. `trunk` names the default branch, `main` by default.
   */
  const setup = ({ trunk = 'main', note = true, map = true } = {}) => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'hook-'))
    run('init', '-q', '-b', trunk)
    run('config', 'user.email', 'a@b.c')
    run('config', 'user.name', 'T')
    if (map) write('docs/knowledge/map.json', MAP)
    if (note) write('src/modules/events/README.md', '# Events\n')
    write('src/modules/events/a.ts', 'export const a = 1\n')
    run('add', '-A')
    run('commit', '-q', '-m', 'init')
    run('checkout', '-q', '-b', 'work')
    write('src/modules/events/a.ts', 'export const a = 2\n')
    return path.join(dir, 'src/modules/events/a.ts')
  }

  it('prints the reminder once per session and never blocks', () => {
    const file = setup()
    const first = edit(file, 'sess-1')
    expect(first.status).toBe(0)
    expect(JSON.parse(first.stdout).hookSpecificOutput.additionalContext).toMatch(
      /src\/modules\/events\/README\.md/,
    )
    const second = edit(file, 'sess-1')
    expect(second.status).toBe(0)
    expect(second.stdout).toBe('')
    // Another session is reminded again
    expect(edit(file, 'sess-other').stdout).not.toBe('')
  })

  it('prints nothing when the note changed compared with main', () => {
    const file = setup()
    write('src/modules/events/README.md', '# Events\n\nA new rule.\n')
    const result = edit(file, 'sess-2')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('prints nothing when the note is new and not committed yet', () => {
    const file = setup({ note: false })
    write('src/modules/events/README.md', '# Events\n')
    const result = edit(file, 'sess-3')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('gives the repository-wide reminder, not a note one, when the mapped note does not exist', () => {
    const file = setup({ note: false })
    const result = edit(file, 'sess-4')
    expect(result.status).toBe(0)
    const message = JSON.parse(result.stdout).hookSpecificOutput.additionalContext
    expect(message).toMatch(/can change behavior/)
    expect(message).not.toMatch(/README\.md/)
  })

  it('reminds about a file outside any mapped module, once, and not after a doc changed', () => {
    setup()
    write('scripts/tool.mjs', 'export const t = 1\n')
    const tool = path.join(dir, 'scripts/tool.mjs')
    expect(JSON.parse(edit(tool, 'sess-7').stdout).hookSpecificOutput.additionalContext).toMatch(
      /scripts\/tool\.mjs/,
    )
    expect(edit(tool, 'sess-7').stdout).toBe('')
    write('docs/new.md', '# New\n')
    expect(edit(tool, 'sess-8').stdout).toBe('')
  })

  it('prints nothing when there is no main to compare with', () => {
    const file = setup({ trunk: 'trunk' })
    const result = edit(file, 'sess-5')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })

  it('prints nothing when the repository has no knowledge map', () => {
    const file = setup({ map: false })
    const result = edit(file, 'sess-6')
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })
})
