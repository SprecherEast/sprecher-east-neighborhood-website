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

describe('the keys of the question tasks', () => {
  const score = (id, answer) => gradeAnswer(answer, task(id).key).score

  it('task 4 needs each bound paired with its setting, so swapped numbers fail', () => {
    const right =
      '| Days ahead (days) | 1 | 31 | 7 |\n| Rows | 1 | 4 | 3 |\n| Most events (limit) | 1 | 6 | 3 |\nTHIS_WEEK_LIMITS'
    const swapped =
      'days: default 31, max 7; rows: max 1; limit: max 3, default 6. THIS_WEEK_LIMITS'
    expect(score('4', right)).toBe('full')
    expect(score('4', swapped)).not.toBe('full')
  })

  it('task 1 needs the CMS pages, category pages and sitemap tag, not just an event page', () => {
    const eventOnly =
      'revalidateEvent refreshes /events/[slug] and the list pages, `/` the home page, and `events`'
    const result = gradeAnswer(eventOnly, task('1').key)
    expect(result.score).not.toBe('full')
    expect(result.missing.length).toBeGreaterThanOrEqual(3)
  })

  it('task 6 needs the rule that an agenda link carries no user name or password', () => {
    const noPassword =
      'officialMeetings: city, county; https:// only, 2048 characters, no whitespace, no username'
    expect(gradeAnswer(noPassword, task('6').key).missing).toEqual(['password'])
  })
})

describe('gradeChange', () => {
  const spec = {
    commands: [
      { cmd: 'npx vitest run' },
      {
        cmd: 'npx tsc --noEmit',
        tolerate: ["error TS2307: Cannot find module 'a/image-hero1.webp'"],
      },
    ],
    mustChange: ['^src/a\\.ts$', '\\.test\\.ts$'],
    mustContain: [{ file: '^src/a\\.ts$', pattern: 'max:\\s*8\\b' }],
  }
  const contents = { 'src/a.ts': 'limit: { min: 1, max: 8 }' }
  const pass = [
    { cmd: 'npx vitest run', code: 0, errors: [] },
    {
      cmd: 'npx tsc --noEmit',
      code: 2,
      errors: ["src/x.ts(1,1): error TS2307: Cannot find module 'a/image-hero1.webp' or types."],
    },
  ]

  it('passes when every command passes and every required file changed', () => {
    expect(
      gradeChange(spec, { commands: pass, changedFiles: ['src/a.ts', 'src/a.test.ts'], contents }),
    ).toEqual({ pass: true, failures: [] })
  })

  it('fails a command that exits non-zero with an error that is not tolerated', () => {
    const commands = [
      pass[0],
      { cmd: 'npx tsc --noEmit', code: 2, errors: ['src/y.ts(2,2): error TS2322: bad'] },
    ]
    const result = gradeChange(spec, {
      commands,
      changedFiles: ['src/a.ts', 'src/a.test.ts'],
      contents,
    })
    expect(result.pass).toBe(false)
    expect(result.failures).toEqual(['command failed: npx tsc --noEmit'])
  })

  it('fails a command that was not run', () => {
    const result = gradeChange(spec, {
      commands: [pass[0]],
      changedFiles: ['src/a.ts', 'src/a.test.ts'],
      contents,
    })
    expect(result.failures).toEqual(['command not run: npx tsc --noEmit'])
  })

  it('fails when a required file did not change', () => {
    const result = gradeChange(spec, { commands: pass, changedFiles: ['src/a.ts'], contents })
    expect(result.failures).toEqual(['no changed file matches \\.test\\.ts$'])
  })

  it('fails a change with the wrong value, even when tests are green and the right file changed', () => {
    const wrong = { 'src/a.ts': 'limit: { min: 1, max: 7 }' }
    const result = gradeChange(spec, {
      commands: pass,
      changedFiles: ['src/a.ts', 'src/a.test.ts'],
      contents: wrong,
    })
    expect(result.failures).toEqual(['no changed file matching ^src/a\\.ts$ contains max:\\s*8\\b'])
  })

  it('fails when the file with the value was not read back', () => {
    const result = gradeChange(spec, {
      commands: pass,
      changedFiles: ['src/a.ts', 'src/a.test.ts'],
      contents: {},
    })
    expect(result.pass).toBe(false)
  })

  it('tolerates a type error only when it is a TS2307 that the task names', () => {
    const tsc = (line) => [pass[0], { cmd: 'npx tsc --noEmit', code: 2, errors: [line] }]
    const changed = { changedFiles: ['src/a.ts', 'src/a.test.ts'], contents }
    const named = "x.ts(1,1): error TS2307: Cannot find module 'a/image-hero1.webp' or types."
    const sameFileOtherError =
      "x.ts(1,1): error TS2322: Type 'a/image-hero1.webp' is not assignable."
    expect(gradeChange(spec, { commands: tsc(named), ...changed }).pass).toBe(true)
    expect(gradeChange(spec, { commands: tsc(sameFileOtherError), ...changed }).pass).toBe(false)
  })

  it('fails a run that changed nothing', () => {
    expect(gradeChange(spec, { commands: pass, changedFiles: [], contents }).pass).toBe(false)
  })
})
