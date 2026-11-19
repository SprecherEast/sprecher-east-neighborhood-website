import { beforeEach, describe, expect, it, vi } from 'vitest'

const data = { findPendingVerification: vi.fn(), wasVerifiedWithToken: vi.fn() }
vi.mock('server-only', () => ({}))
vi.mock('../data/signUp', () => ({
  findPendingVerification: (token: string) => data.findPendingVerification(token),
  wasVerifiedWithToken: (token: string) => data.wasVerifiedWithToken(token),
}))

import { getVerificationLinkStatus } from './getVerificationLinkStatus'

const TOKEN = '0123456789abcdef0123456789abcdef01234567'

beforeEach(() => {
  data.findPendingVerification.mockReset().mockResolvedValue(null)
  data.wasVerifiedWithToken.mockReset().mockResolvedValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getVerificationLinkStatus (#391)', () => {
  it('leaves a link that still holds its token pending', async () => {
    data.findPendingVerification.mockResolvedValue({ id: 9, setsPassword: false })
    expect(await getVerificationLinkStatus(TOKEN)).toBe('pending')
    expect(data.wasVerifiedWithToken).not.toHaveBeenCalled()
  })

  it('says a link that verified its account is already verified', async () => {
    data.wasVerifiedWithToken.mockResolvedValue(true)
    expect(await getVerificationLinkStatus(TOKEN)).toBe('already-verified')
    expect(data.wasVerifiedWithToken).toHaveBeenCalledExactlyOnceWith(TOKEN)
  })

  it('says a link no account knows isn’t valid', async () => {
    expect(await getVerificationLinkStatus(TOKEN)).toBe('invalid')
  })

  it('reads nothing for a token that can’t be one', async () => {
    expect(await getVerificationLinkStatus(['x'])).toBe('invalid')
    expect(data.findPendingVerification).not.toHaveBeenCalled()
  })

  it('falls back to the Confirm button when the read fails, logging only the error’s name', async () => {
    data.findPendingVerification.mockRejectedValue(new TypeError('db'))
    expect(await getVerificationLinkStatus(TOKEN)).toBe('pending')
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'Reading a verification link failed on the server (TypeError)',
    )
  })
})
