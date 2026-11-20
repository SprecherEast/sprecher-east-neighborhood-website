// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The accounts module is replaced: this tests the page's wiring, not the module
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasPendingGoogleLink: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/modules/accounts/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  hasPendingGoogleLink: mocks.hasPendingGoogleLink,
  ConnectGoogleForm: () => <form aria-label="Connect Google" />,
  ConnectGoogleClosed: () => <p role="alert">We couldn’t connect Google. Please start again</p>,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))

import ConnectGooglePage, { metadata } from './page'

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockClear()
  mocks.getCurrentUser.mockResolvedValue(null)
  mocks.hasPendingGoogleLink.mockResolvedValue(true)
})
afterEach(cleanup)

const page = (provider = 'google') => ConnectGooglePage({ params: Promise.resolve({ provider }) })

describe('/auth/[provider]/connect', () => {
  it('asks for the password once, in the words of the log in flow, and shows no email', async () => {
    render(await page())
    expect(screen.getByRole('heading', { name: 'Connect Google' })).toBeTruthy()
    expect(
      screen.getByText(
        'This email already has an account. Enter your password once to connect Google.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('form', { name: 'Connect Google' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/@/)
  })

  it('shows the closed view, with no form, when no record waits for this browser', async () => {
    mocks.hasPendingGoogleLink.mockResolvedValue(false)
    render(await page())
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Please start again')
    expect(screen.queryByText(/Enter your password once/)).toBeNull()
  })

  it('answers 404 for a provider the site doesn’t know, and moves a signed-in person on', async () => {
    await expect(page('apple')).rejects.toThrow('NEXT_NOT_FOUND')
    mocks.getCurrentUser.mockResolvedValue({ id: 7 })
    await expect(page()).rejects.toThrow('NEXT_REDIRECT /account')
  })

  it('stays out of search results', () => {
    expect(metadata.robots).toMatchObject({ index: false })
  })
})
