import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

/** An issue body the way the issue forms write it */
const body = (files, mustNot) =>
  ['### Files likely touched', files, '### Must not touch', mustNot].join('\n\n')

describe('the command line', () => {
  const run = (issues, ...args) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlap-'))
    const file = path.join(dir, 'issues.json')
    fs.writeFileSync(file, JSON.stringify(issues))
    return spawnSync('node', [path.join(here, 'overlap-check.mjs'), file, ...args], {
      encoding: 'utf8',
    })
  }

  it('exits 0 and says so when nothing clashes', () => {
    const result = run([
      { number: 1, body: body('`src/a`', 'None') },
      { number: 2, body: body('`src/b`', 'None') },
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No overlap')
  })

  it('exits non-zero and lists the clash', () => {
    const result = run([
      { number: 1, body: body('`src/a`', 'None') },
      { number: 2, files: ['src/a/x.ts'], mustNotTouch: [] },
    ])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('#1 / #2 files')
  })

  it('exits 2 on bad input', () => {
    expect(spawnSync('node', [path.join(here, 'overlap-check.mjs')]).status).toBe(2)
    expect(run({ not: 'an array' }).status).toBe(2)
  })

  it('exits 2 for an empty list, which would otherwise read as "claim it"', () => {
    expect(run([]).status).toBe(2)
    expect(run([], '--candidate', '7').status).toBe(2)
  })

  it('exits 2 when the candidate is not in the list', () => {
    const result = run([{ number: 1, files: ['src/a'], mustNotTouch: [] }], '--candidate', '7')
    expect(result.status).toBe(2)
    expect(result.stdout).toContain('#7')
  })

  it('exits 2 when the candidate is not a number', () => {
    expect(run([{ number: 1, files: ['src/a'] }], '--candidate', 'x').status).toBe(2)
  })

  it('exits 2 for a files value that is not a list of strings, not 1', () => {
    expect(run([{ number: 1, files: 'src/a' }]).status).toBe(2)
    expect(run([{ number: 1, files: [3] }]).status).toBe(2)
    expect(run([{ number: 1, files: ['src/a'], blockedBy: 'x' }]).status).toBe(2)
  })

  it('exits 2 for duplicate issue numbers', () => {
    const result = run([
      { number: 1, files: ['src/a'] },
      { number: 1, files: ['src/a'] },
    ])
    expect(result.status).toBe(2)
    expect(result.stdout).toContain('twice')
  })
})
