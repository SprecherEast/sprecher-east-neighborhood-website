// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The module's component is replaced: this tests the page's wiring, not the module
const linkStatus = vi.fn()
vi.mock('@/modules/verification/server', () => ({
  getConfirmationLinkStatus: (value: unknown) => linkStatus(value),
  ConfirmEmail: ({
    token,
    status,
    retryHref,
    children,
  }: {
    token: string | null
    status: string
    retryHref: string
    children?: React.ReactNode
  }) => (
    <div>
      <p>
        token: {String(token)}, status: {status}, retry: {retryHref}
      </p>
      {children}
    </div>
  ),
}))
vi.mock('@/modules/accounts/server', () => ({ AccountOffer: () => <p>Account offer</p> }))

import ConfirmEmailPage, { metadata } from './page'

beforeEach(() => linkStatus.mockReset().mockResolvedValue('pending'))
afterEach(cleanup)

const TOKEN = 'a'.repeat(43)
const open = async (token?: string | string[]) =>
  render(await ConfirmEmailPage({ searchParams: Promise.resolve({ token }) }))

describe('/confirm-email', () => {
  it('hands a well-formed token from the link to the confirm button', async () => {
    await open(TOKEN)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confirm Your Email')
    expect(screen.getByText(`token: ${TOKEN}, status: pending, retry: /contact`)).toBeTruthy()
    expect(linkStatus).toHaveBeenCalledExactlyOnceWith(TOKEN)
  })

  it('puts the account offer in the slot that shows once the email is confirmed (#187)', async () => {
    await open(TOKEN)
    expect(screen.getByText('Account offer')).toBeTruthy()
  })

  it.each([[undefined], ['short'], [[TOKEN, TOKEN]]])('hands on no token for %j', async (token) => {
    await open(token)
    expect(screen.getByText(/^token: null, status: pending/)).toBeTruthy()
  })

  it('says a link opened again is already confirmed, without the one-click intro (#391)', async () => {
    linkStatus.mockResolvedValue('already-confirmed')
    await open(TOKEN)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Email Confirmed')
    expect(screen.queryByText(/One click to confirm/)).toBeNull()
    expect(
      screen.getByText(`token: ${TOKEN}, status: already-confirmed, retry: /contact`),
    ).toBeTruthy()
  })

  it('sends no referrer and asks not to be indexed, as the token is in its address', () => {
    expect(metadata.referrer).toBe('no-referrer')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
