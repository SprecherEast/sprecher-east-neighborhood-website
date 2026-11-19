import { beforeEach, describe, expect, it, vi } from 'vitest'

const findLinkState = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('../data/links', () => ({ findLinkState: (token: string) => findLinkState(token) }))

import { getConfirmationLinkStatus } from './getConfirmationLinkStatus'

const TOKEN = 'a'.repeat(43)
const iso = (ms: number) => new Date(ms).toISOString()

beforeEach(() => {
  findLinkState.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getConfirmationLinkStatus (#391)', () => {
  it('says a confirmed address’s link is already confirmed', async () => {
    findLinkState.mockResolvedValue({ confirmedAt: iso(Date.now() - 1000), tokenExpiresAt: null })
    expect(await getConfirmationLinkStatus(TOKEN)).toBe('already-confirmed')
    expect(findLinkState).toHaveBeenCalledExactlyOnceWith(TOKEN)
  })

  it('leaves a link still to confirm pending', async () => {
    findLinkState.mockResolvedValue({ confirmedAt: null, tokenExpiresAt: iso(Date.now() + 60_000) })
    expect(await getConfirmationLinkStatus(TOKEN)).toBe('pending')
  })

  it('says a link no record holds isn’t valid', async () => {
    findLinkState.mockResolvedValue(null)
    expect(await getConfirmationLinkStatus(TOKEN)).toBe('invalid')
  })

  it.each([[undefined], ['short'], [[TOKEN]]])(
    'reads nothing for a token that can’t be ours (%j)',
    async (value) => {
      expect(await getConfirmationLinkStatus(value)).toBe('invalid')
      expect(findLinkState).not.toHaveBeenCalled()
    },
  )

  it('falls back to the Confirm button when the read fails, logging only the error’s kind', async () => {
    findLinkState.mockRejectedValue(new TypeError('db ana@example.com'))
    expect(await getConfirmationLinkStatus(TOKEN)).toBe('pending')
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'Reading a confirmation link failed on the server (TypeError)',
    )
  })
})
