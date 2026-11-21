// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The accounts module is replaced: this tests the page's wiring, not the module
const accounts = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
  arePasskeysOn: vi.fn(),
  getGoogleConnection: vi.fn(),
  getOwnPasskeys: vi.fn(),
}))
vi.mock('@/modules/accounts/server', () => ({
  requireUser: accounts.requireUser,
  getCurrentUser: accounts.getCurrentUser,
  arePasskeysOn: accounts.arePasskeysOn,
  getGoogleConnection: accounts.getGoogleConnection,
  ConnectGoogle: ({ connection, result }: { connection: string; result?: unknown }) => (
    <section aria-label="Google" data-connection={connection} data-result={String(result)} />
  ),
  getOwnPasskeys: accounts.getOwnPasskeys,
  PasskeysCard: ({ passkeys }: { passkeys: unknown[] }) => (
    <section aria-label="Passkeys" data-count={passkeys.length} />
  ),
  PasskeyOffer: ({ eligible }: { eligible: boolean }) => (
    <section aria-label="Passkey offer" data-eligible={String(eligible)} />
  ),
  ChangePasswordForm: () => <form aria-label="Change password" />,
}))

import AccountPage from './page'

afterEach(cleanup)
beforeEach(() => {
  accounts.getOwnPasskeys.mockReset().mockResolvedValue([])
  accounts.arePasskeysOn.mockReset().mockReturnValue(false)
  accounts.getGoogleConnection.mockResolvedValue('off')
  searchParams = Promise.resolve({})
})

let searchParams: Promise<Record<string, string | string[] | undefined>> = Promise.resolve({})

const signedIn = () =>
  accounts.requireUser.mockResolvedValue({
    id: 7,
    email: 'ada@example.com',
    name: 'Ada',
    role: 'resident',
  })

describe('/account', () => {
  it('lets only a signed-in user in, through requireUser', async () => {
    accounts.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'))
    accounts.getCurrentUser.mockResolvedValue(null)
    await expect(AccountPage({ searchParams })).rejects.toThrow('NEXT_REDIRECT /login')
  })

  it('shows the signed-in user’s name and email, and the password form', async () => {
    signedIn()
    render(await AccountPage({ searchParams }))
    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.getByText('ada@example.com')).toBeTruthy()
    expect(screen.getByRole('form', { name: 'Change password' })).toBeTruthy()
  })

  it('hides the passkey card entirely while the switch is off, and reads no passkeys', async () => {
    signedIn()
    accounts.arePasskeysOn.mockReturnValue(false)
    render(await AccountPage({ searchParams }))
    expect(screen.queryByRole('region', { name: 'Passkeys' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Passkey offer' })).toBeNull()
    expect(accounts.getOwnPasskeys).not.toHaveBeenCalled()
    expect(screen.getByRole('form', { name: 'Change password' })).toBeTruthy()
  })

  it('shows the passkey card after the password form once the switch is on', async () => {
    signedIn()
    accounts.arePasskeysOn.mockReturnValue(true)
    accounts.getOwnPasskeys.mockResolvedValue([{ id: 1 }, { id: 2 }])
    render(await AccountPage({ searchParams }))
    const card = screen.getByRole('region', { name: 'Passkeys' })
    // The list is the session's own account's, read by the id requireUser answered with
    expect(accounts.getOwnPasskeys).toHaveBeenCalledExactlyOnceWith(7)
    expect(card.getAttribute('data-count')).toBe('2')
    const password = screen.getByRole('form', { name: 'Change password' })
    expect(password.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers a passkey at the top, only to an account with none (#1364)', async () => {
    signedIn()
    accounts.arePasskeysOn.mockReturnValue(true)
    accounts.getOwnPasskeys.mockResolvedValue([])
    render(await AccountPage({ searchParams }))
    const offer = screen.getByRole('region', { name: 'Passkey offer' })
    expect(offer.getAttribute('data-eligible')).toBe('true')
    // Above everything else, so it is seen right after a log in
    expect(
      screen.getByText('Profile').compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy()
    cleanup()

    accounts.getOwnPasskeys.mockResolvedValue([{ id: 1 }])
    render(await AccountPage({ searchParams }))
    expect(
      screen.getByRole('region', { name: 'Passkey offer' }).getAttribute('data-eligible'),
    ).toBe('false')
  })

  it('hides the Google card while Google is off', async () => {
    signedIn()
    render(await AccountPage({ searchParams }))
    expect(screen.queryByRole('region', { name: 'Google' })).toBeNull()
    expect(accounts.getGoogleConnection).toHaveBeenCalledWith(7)
  })

  it('shows the Google card with the session’s account state, and how a connect ended', async () => {
    signedIn()
    accounts.getGoogleConnection.mockResolvedValue('available')
    searchParams = Promise.resolve({ social: 'taken' })
    render(await AccountPage({ searchParams }))
    const card = screen.getByRole('region', { name: 'Google' })
    expect(card.getAttribute('data-connection')).toBe('available')
    expect(card.getAttribute('data-result')).toBe('taken')
    const password = screen.getByRole('form', { name: 'Change password' })
    expect(password.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
