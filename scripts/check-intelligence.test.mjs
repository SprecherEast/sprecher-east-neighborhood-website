/**
 * `check-intelligence.mjs` reads the frontmatter of each prompt through `frontmatter.mjs`. These
 * run it on a copy of `intelligence/` with the first prompt written in the shapes the reader
 * accepts, and with a wrong stage, which must still fail.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROMPT = 'prompts/curate.md'
let tmp
let original

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'intelligence-'))
  fs.cpSync(path.join(root, 'intelligence'), tmp, { recursive: true })
  original = fs.readFileSync(path.join(tmp, PROMPT), 'utf8')
})

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

/** Exit code of the check on the copy, with the first prompt replaced by `text`. */
function check(text) {
  fs.writeFileSync(path.join(tmp, PROMPT), text)
  return spawnSync(process.execPath, [path.join(root, 'scripts/check-intelligence.mjs'), tmp], {
    cwd: root,
    encoding: 'utf8',
  })
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

  it('fails when the stage in the frontmatter is wrong', () => {
    const result = check(original.replace(/^stage: .*$/m, 'stage: nonsense'))
    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toContain('front matter must say stage')
  })
})
