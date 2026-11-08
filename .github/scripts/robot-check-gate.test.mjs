import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'robot-check-gate.sh')

let dir
let output

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-check-gate-'))
  output = path.join(dir, 'out')
  fs.writeFileSync(output, '')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function run(env) {
  const result = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, GITHUB_OUTPUT: output, ...env },
  })
  return {
    code: result.status,
    out: result.stdout + result.stderr,
    written: fs.readFileSync(output, 'utf8'),
  }
}

describe('robot-check-gate.sh', () => {
  it('lets a deploy with both keys go, with the check on', () => {
    const { code, written } = run({ SITE_KEY: '0x4AAA', SECRET_SET: 'yes' })
    expect(code).toBe(0)
    expect(written).toBe('turnstile_paired=yes\n')
  })

  it('stops a deploy with neither key, and says how to go on', () => {
    const { code, out, written } = run({ SITE_KEY: '', SECRET_SET: 'no' })
    expect(code).toBe(1)
    expect(out).toContain('::error title=Robot check::neither Turnstile key')
    expect(out).toContain('ALLOW_NO_ROBOT_CHECK')
    expect(written).toBe('')
  })

  it.each(['', 'false', 'yes', '1', 'TRUE'])('does not take %j as the opt-out', (value) => {
    const { code } = run({ SITE_KEY: '', SECRET_SET: 'no', ALLOW_NO_ROBOT_CHECK: value })
    expect(code).toBe(1)
  })

  it('lets a deploy with neither key go, with a warning, when the opt-out is true', () => {
    const { code, out, written } = run({
      SITE_KEY: '',
      SECRET_SET: 'no',
      ALLOW_NO_ROBOT_CHECK: 'true',
    })
    expect(code).toBe(0)
    expect(out).toContain('::warning title=Robot check::deploying WITHOUT a robot check')
    expect(written).toBe('turnstile_paired=no\n')
  })

  it.each([
    ['only the site key', { SITE_KEY: '0x4AAA', SECRET_SET: 'no' }],
    ['only the secret', { SITE_KEY: '', SECRET_SET: 'yes' }],
  ])('stops %s, even with the opt-out', (_label, keys) => {
    for (const optOut of ['', 'true']) {
      const { code, out } = run({ ...keys, ALLOW_NO_ROBOT_CHECK: optOut })
      expect(code).toBe(1)
      expect(out).toContain('only one of the two Turnstile keys')
    }
  })

  it('keeps the check on, and notes the unused opt-out, when both keys are set', () => {
    const { code, out, written } = run({
      SITE_KEY: '0x4AAA',
      SECRET_SET: 'yes',
      ALLOW_NO_ROBOT_CHECK: 'true',
    })
    expect(code).toBe(0)
    expect(out).toContain('has no effect')
    expect(written).toBe('turnstile_paired=yes\n')
  })
})
