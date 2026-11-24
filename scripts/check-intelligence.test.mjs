/**
 * `check-intelligence.mjs` reads the frontmatter of each prompt through `frontmatter.mjs`. These
 * run it on a copy of `intelligence/` with the first prompt written in the shapes the reader
 * accepts, and with a wrong stage, which must still fail.
 */
import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { copyIntelligence, runCheck } from './check-intelligence-harness.mjs'

const PROMPT = 'prompts/curate.md'
let tmp
let original

beforeAll(() => {
  tmp = copyIntelligence()
  original = fs.readFileSync(path.join(tmp, PROMPT), 'utf8')
})

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

/** Exit code of the check on the copy, with the first prompt replaced by `text`. */
function check(text) {
  fs.writeFileSync(path.join(tmp, PROMPT), text)
  return runCheck(tmp)
}

describe('check-intelligence prompt frontmatter', () => {
  it('passes the prompt as it is', () => {
    expect(check(original).status).toBe(0)
  })

  it('passes with Windows line endings', () => {
    expect(check(original.replace(/\n/g, '\r\n')).status).toBe(0)
  })

  it('passes with trailing spaces on the closing delimiter line', () => {
    expect(check(original.replace(/\n---\n/, '\n---   \n')).status).toBe(0)
  })

  it('fails when the opening delimiter line has trailing spaces, as it did before the shared reader', () => {
    expect(check(original.replace(/^---\n/, '---  \n')).status).toBe(1)
  })

  it('fails when the stage in the frontmatter is wrong', () => {
    const result = check(original.replace(/^stage: .*$/m, 'stage: nonsense'))
    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toContain('front matter must say stage')
  })
})
