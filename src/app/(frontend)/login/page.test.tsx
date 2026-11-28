// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The accounts module is replaced: this tests the page's wiring, not the module
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  arePasskeysOn: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
}))
vi.mock('@/modules/accounts/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  arePasskeysOn: mocks.arePasskeysOn,
  getEnabledSocialProviders: () => [],
  SignInForm: ({
    passkeys,
    social,
    returnTo,
  }: {
    passkeys?: boolean
    social?: React.ReactNode
    returnTo?: string
  }) => (
    <form aria-label="Log in" data-passkeys={String(passkeys)} data-return={returnTo}>
      {social}
    </form>
  ),
  SocialSignIn: () => <p data-testid="buttons">Google button</p>,
  SocialSignInMessage: ({ result }: { result?: unknown }) => (
    <p data-testid="social">{String(result ?? '')}</p>
  ),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
// The agents module's own entry holds only types and pure rules, so the real one is used

import LoginPage from './page'

const page = (query: Record<string, string> = {}) => ({ searchParams: Promise.resolve(query) })

beforeEach(() => {
  mocks.redirect.mockClear()
  mocks.arePasskeysOn.mockReset().mockReturnValue(false)
})
afterEach(cleanup)

describe('/login', () => {
  it('sends a signed-in user to their account', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 7, email: 'a@example.com', name: null })
    await expect(LoginPage(page())).rejects.toThrow('NEXT_REDIRECT /account')
  })

  const APPROVE = '/oauth/approve?client_id=mcp_a&state=s'

  it('takes a visitor back to the connection approval after logging in, and a signed-in one now', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page({ next: APPROVE })))
    expect(screen.getByRole('form', { name: 'Log in' }).getAttribute('data-return')).toBe(APPROVE)
    cleanup()
    mocks.getCurrentUser.mockResolvedValue({ id: 7, email: 'a@example.com', name: null })
    await expect(LoginPage(page({ next: APPROVE }))).rejects.toThrow(`NEXT_REDIRECT ${APPROVE}`)
  })

  it.each([
    'https://evil.example/oauth/approve',
    '//evil.example/oauth/approve',
    '/account',
    '/\\evil.example',
  ])('is never an open redirect: %s goes to the account', async (next) => {
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page({ next })))
    expect(screen.getByRole('form', { name: 'Log in' }).getAttribute('data-return')).toBe(
      '/account',
    )
    cleanup()
    mocks.getCurrentUser.mockResolvedValue({ id: 7, email: 'a@example.com', name: null })
    await expect(LoginPage(page({ next }))).rejects.toThrow('NEXT_REDIRECT /account')
  })

  it('shows a visitor the sign-in form', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page()))
    expect(screen.getByRole('form', { name: 'Log in' })).toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('passes a provider sign-in outcome to the provider buttons', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page({ social: 'failed' })))
    expect(screen.getByTestId('social').textContent).toBe('failed')
  })

  it('hands the form the provider buttons, to sit with the passkey above the fields (#1365)', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page()))
    expect(screen.getByRole('form', { name: 'Log in' }).textContent).toContain('Google button')
  })

  it('offers a passkey only while the switch is on (#1315)', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page()))
    expect(screen.getByRole('form', { name: 'Log in' }).getAttribute('data-passkeys')).toBe('false')
    cleanup()

    mocks.arePasskeysOn.mockReturnValue(true)
    render(await LoginPage(page()))
    expect(screen.getByRole('form', { name: 'Log in' }).getAttribute('data-passkeys')).toBe('true')
  })

  it('credits the passkey icon to its owner, only while passkeys are on (#1365)', async () => {
    const credit = 'The passkey icon is a trademark of FIDO Alliance, Inc.'
    mocks.getCurrentUser.mockResolvedValue(null)
    render(await LoginPage(page()))
    expect(screen.queryByText(credit)).toBeNull()
    cleanup()

    mocks.arePasskeysOn.mockReturnValue(true)
    render(await LoginPage(page()))
    expect(screen.getByText(credit)).toBeTruthy()
  })
})
