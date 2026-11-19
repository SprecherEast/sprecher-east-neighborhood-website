// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The module's component is replaced: this tests the page's wiring, not the module
const linkStatus = vi.fn()
vi.mock('@/modules/accounts/server', () => ({
  getVerificationLinkStatus: (value: unknown) => linkStatus(value),
  VerifyAccount: ({ token, status }: { token: string | null; status: string }) => (
    <p>
      token: {String(token)}, status: {status}
    </p>
  ),
}))

import VerifyAccountPage, { metadata } from './page'

beforeEach(() => linkStatus.mockReset().mockResolvedValue('pending'))
afterEach(cleanup)

const TOKEN = '0123456789abcdef0123456789abcdef01234567'
const open = async (token?: string | string[]) =>
  render(await VerifyAccountPage({ searchParams: Promise.resolve({ token }) }))

describe('/verify-account', () => {
  it('hands the link’s token to the confirm button', async () => {
    await open(TOKEN)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confirm Your Account')
    expect(screen.getByText(`token: ${TOKEN}, status: pending`)).toBeTruthy()
    expect(linkStatus).toHaveBeenCalledExactlyOnceWith(TOKEN)
  })

  it.each([[undefined], ['short'], [[TOKEN, TOKEN]]])('hands on no token for %j', async (token) => {
    await open(token)
    expect(screen.getByText(/^token: null/)).toBeTruthy()
  })

  it('says a link opened again is already confirmed, without the one-click intro (#391)', async () => {
    linkStatus.mockResolvedValue('already-verified')
    await open(TOKEN)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Account Confirmed')
    expect(screen.queryByText(/One click to confirm/)).toBeNull()
    expect(screen.getByText(`token: ${TOKEN}, status: already-verified`)).toBeTruthy()
  })

  it('sends no referrer and asks not to be indexed, as the token is in its address', () => {
    expect(metadata.referrer).toBe('no-referrer')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
