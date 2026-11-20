// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The accounts module is replaced: this tests the page's wiring, not the module
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
}))
vi.mock('@/modules/accounts/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  getEnabledSocialProviders: () => [],
  SocialSignIn: () => null,
  SignUpForm: ({ email }: { email: string | null }) => <p>email: {String(email)}</p>,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import SignUpPage, { metadata } from './page'

beforeEach(() => {
  mocks.redirect.mockClear()
  mocks.getCurrentUser.mockResolvedValue(null)
})
afterEach(cleanup)

const open = async (email?: string | string[]) =>
  render(await SignUpPage({ searchParams: Promise.resolve({ email }) }))

describe('/sign-up', () => {
  it('sends a signed-in user to their account', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 7, email: 'a@example.com', name: null })
    await expect(SignUpPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT /account',
    )
  })

  it('hands the email from the address to the form, as the site stores it', async () => {
    await open(' Ana@Example.com ')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Create an Account')
    expect(screen.getByText('email: ana@example.com')).toBeTruthy()
  })

  it.each([[undefined], ['not an email'], [['a@example.com', 'b@example.com']]])(
    'hands on no email for %j',
    async (email) => {
      await open(email)
      expect(screen.getByText('email: null')).toBeTruthy()
    },
  )

  it('sends no referrer and asks not to be indexed, as the email can be in its address', () => {
    expect(metadata.referrer).toBe('no-referrer')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
