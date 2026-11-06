import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { gradeAnswer, gradeChange, normalize } from './grade.mjs'
import { loadTasks } from './tasks.mjs'
import { parseTranscript } from './transcript.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const answerOf = (name) =>
  parseTranscript(fs.readFileSync(path.join(dir, `${name}.jsonl`), 'utf8'), `/work/${name}`).answer
const task = (id) => loadTasks().find((t) => t.id === id)

describe('normalize', () => {
  it('lowercases, drops asterisks and double quotes, and collapses spaces but not line breaks', () => {
    expect(normalize('On  or **after** "Today"\n`x`')).toBe('on or after today\n`x`')
  })
})

describe('gradeAnswer', () => {
  const key = [['alpha'], ['/be+ta/'], ['gamma', 'delta']]

  it('is full when every fact is found, by any of its alternatives', () => {
    expect(gradeAnswer('ALPHA, beeta and Delta', key)).toMatchObject({ score: 'full', missing: [] })
  })

  it('is half when at least half of the facts are found, and names what is missing', () => {
    expect(gradeAnswer('alpha and gamma', key)).toMatchObject({
      score: 'half',
      missing: ['/be+ta/'],
    })
  })

  it('is none below half, and for an empty answer', () => {
    expect(gradeAnswer('alpha', key).score).toBe('none')
    expect(gradeAnswer('', key).score).toBe('none')
  })

  it('reads an alternative wrapped in slashes as a regular expression, ignoring case', () => {
    expect(gradeAnswer('Days ahead | 1 | 31', [['/days[^\\n]*\\b31\\b/']]).score).toBe('full')
    expect(gradeAnswer('Days ahead | 1 | 310', [['/days[^\\n]*\\b31\\b/']]).score).toBe('none')
  })

  it('grades real answers of the pilot against the task key', () => {
    expect(gradeAnswer(answerOf('A-3-1'), task('3').key).score).toBe('full')
    expect(gradeAnswer(answerOf('B-3-1'), task('3').key).score).toBe('full')
  })
})

describe('gradeChange', () => {
  const spec = {
    commands: [
      { cmd: 'npx vitest run' },
      { cmd: 'npx tsc --noEmit', tolerate: ['image-hero1.webp'] },
    ],
    mustChange: ['^src/a\\.ts$', '\\.test\\.ts$'],
  }
  const pass = [
    { cmd: 'npx vitest run', code: 0, errors: [] },
    {
      cmd: 'npx tsc --noEmit',
      code: 2,
      errors: ["src/x.ts(1,1): error TS2307: Cannot find 'image-hero1.webp'"],
    },
  ]

  it('passes when every command passes and every required file changed', () => {
    expect(
      gradeChange(spec, { commands: pass, changedFiles: ['src/a.ts', 'src/a.test.ts'] }),
    ).toEqual({ pass: true, failures: [] })
  })

  it('fails a command that exits non-zero with an error that is not tolerated', () => {
    const commands = [
      pass[0],
      { cmd: 'npx tsc --noEmit', code: 2, errors: ['src/y.ts(2,2): error TS2322: bad'] },
    ]
    const result = gradeChange(spec, { commands, changedFiles: ['src/a.ts', 'src/a.test.ts'] })
    expect(result.pass).toBe(false)
    expect(result.failures).toEqual(['command failed: npx tsc --noEmit'])
  })

  it('fails a command that was not run', () => {
    const result = gradeChange(spec, {
      commands: [pass[0]],
      changedFiles: ['src/a.ts', 'src/a.test.ts'],
    })
    expect(result.failures).toEqual(['command not run: npx tsc --noEmit'])
  })

  it('fails when a required file did not change', () => {
    const result = gradeChange(spec, { commands: pass, changedFiles: ['src/a.ts'] })
    expect(result.failures).toEqual(['no changed file matches \\.test\\.ts$'])
  })

  it('fails a run that changed nothing', () => {
    expect(gradeChange(spec, { commands: pass, changedFiles: [] }).pass).toBe(false)
  })
})
