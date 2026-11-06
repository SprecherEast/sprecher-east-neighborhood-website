import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildRunRow, collectRows } from './analyze.mjs'
import { loadTasks } from './tasks.mjs'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const transcript = (name) => fs.readFileSync(path.join(fixtures, `${name}.jsonl`), 'utf8')
const task = (id) => loadTasks().find((t) => t.id === id)

describe('buildRunRow', () => {
  it('grades a question run against its key', () => {
    const meta = { cond: 'B', task: '3', rep: 1, workdir: '/work/B-3-1' }
    expect(buildRunRow(task('3'), meta, transcript('B-3-1'))).toMatchObject({
      cond: 'B',
      task: '3',
      grade: 'full',
      toolCalls: 2,
      filesRead: 1,
      tokens: 6 + 818 + 85750 + 49348,
    })
  })

  it('grades a change run by what the runner recorded after the session', () => {
    const base = { cond: 'A', task: '7', rep: 1, workdir: '/work/A-7-1' }
    const commands = [
      { cmd: 'npx vitest run src/modules/events', code: 0, errors: [] },
      { cmd: 'npx tsc --noEmit', code: 0, errors: [] },
    ]
    const changedFiles = [
      'src/modules/events/domain/thisWeek.ts',
      'src/modules/events/domain/thisWeek.test.ts',
    ]
    expect(
      buildRunRow(task('7'), { ...base, commands, changedFiles }, transcript('A-7-1')).grade,
    ).toBe('pass')
    expect(
      buildRunRow(task('7'), { ...base, commands, changedFiles: [] }, transcript('A-7-1')).grade,
    ).toBe('fail')
  })

  it('fails a change run whose session never finished, even if the files look right', () => {
    const meta = { cond: 'A', task: '7', rep: 1, workdir: '/w', commands: [], changedFiles: [] }
    expect(buildRunRow(task('7'), meta, '').grade).toBe('fail')
  })
})

describe('collectRows', () => {
  it('reads every run in a results folder and skips one without a transcript', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-eval-test-'))
    try {
      fs.copyFileSync(path.join(fixtures, 'A-3-1.jsonl'), path.join(dir, 'A-3-1.jsonl'))
      fs.writeFileSync(
        path.join(dir, 'A-3-1.json'),
        JSON.stringify({ cond: 'A', task: '3', rep: 1, workdir: '/work/A-3-1' }),
      )
      fs.writeFileSync(
        path.join(dir, 'A-4-1.json'),
        JSON.stringify({ cond: 'A', task: '4', rep: 1, workdir: '/w' }),
      )
      const rows = collectRows(dir, loadTasks())
      expect(rows.map((r) => `${r.cond}-${r.task}-${r.rep}`)).toEqual(['A-3-1'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
