import { describe, expect, it, vi } from 'vitest'

import { PREVIEW_ACCOUNT_ROLES } from './preview-accounts'
import { runPreviewSeed } from './run-preview-seed'

/**
 * What e2e/previewSeed.ts does, as a function (#1393): the deploy log is public, so a failure prints one
 * fixed line, never an error from Payload or the database, whose text and stack could carry a value.
 */

const passwords = Object.fromEntries(PREVIEW_ACCOUNT_ROLES.map((r) => [r, 'a'.repeat(64)]))
const logger = () => ({ info: vi.fn(), error: vi.fn() })

describe('runPreviewSeed', () => {
  it('says only how many accounts were made or refreshed, and succeeds', async () => {
    const log = logger()
    const code = await runPreviewSeed({
      readPasswords: () => passwords as never,
      getLogger: async () => log,
      seed: async () => ({ created: 4, refreshed: 0 }),
    })
    expect(code).toBe(0)
    expect(log.info).toHaveBeenCalledOnce()
    expect(String(log.info.mock.calls[0][0])).toContain('4 test accounts made')
    expect(log.error).not.toHaveBeenCalled()
  })

  it.each(['reading the file', 'opening Payload', 'seeding'])(
    'prints one fixed line and fails when %s throws, never the error’s text or stack',
    async (stage) => {
      const leak = new Error(`SQLITE_ERROR near ${'b'.repeat(64)}`)
      const log = logger()
      const printed: string[] = []
      const out = vi
        .spyOn(console, 'error')
        .mockImplementation((...a) => void printed.push(a.join(' ')))
      const code = await runPreviewSeed({
        readPasswords: () => {
          if (stage === 'reading the file') throw leak
          return passwords as never
        },
        getLogger: async () => {
          if (stage === 'opening Payload') throw leak
          return log
        },
        seed: async () => {
          throw leak
        },
        fallbackLog: console,
      })
      out.mockRestore()
      expect(code).toBe(1)
      const all = [...printed, ...log.error.mock.calls.flat().map(String)].join('\n')
      expect(all).toContain('the test accounts could not be made')
      expect(all).not.toContain('SQLITE')
      expect(all).not.toContain('b'.repeat(64))
      expect(all).not.toContain('at ') // no stack
    },
  )
})
