import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'umami-id-gate.sh')

const run = (env) =>
  spawnSync('bash', [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } })

describe('umami-id-gate.sh', () => {
  it.each(['', 'a969368e-4514-4aa9-828a-fb0cd9d8330b', 'A969368E-4514-4AA9-828A-FB0CD9D8330B'])(
    'lets %j through',
    (value) => {
      expect(run({ UMAMI_ID: value }).status).toBe(0)
    },
  )

  it('lets an unset value through', () => {
    expect(run({}).status).toBe(0)
  })

  it.each([
    'not-an-id',
    '------------------------------------', // 36 characters, none of them hex
    'a969368e-4514-4aa9-828a-fb0cd9d8330', // one short
    'a969368e45144aa9828afb0cd9d8330b0000', // no dashes
    'g969368e-4514-4aa9-828a-fb0cd9d8330b',
    'a969368e-4514-4aa9-828a-fb0cd9d8330b ',
  ])('stops on %j, and says what to fix', (value) => {
    const result = run({ UMAMI_ID: value })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('::error title=Preflight::NEXT_PUBLIC_UMAMI_WEBSITE_ID')
  })
})
