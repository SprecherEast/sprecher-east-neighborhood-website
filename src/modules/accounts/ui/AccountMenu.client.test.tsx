// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSignedInAccount: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  pathname: '/',
}))
vi.mock('../actions', () => ({
  getSignedInAccount: mocks.getSignedInAccount,
  signOut: mocks.signOut,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { AccountMenu } from './AccountMenu.client'
import { AccountProvider } from './AccountProvider.client'

const header = () => (
  <AccountProvider>
    <nav aria-label="Bar">
      <AccountMenu variant="bar" />
    </nav>
    <nav aria-label="Drawer">
      <AccountMenu variant="drawer" />
    </nav>
  </AccountProvider>
)

beforeEach(() => {
  mocks.pathname = '/'
  for (const fn of [mocks.getSignedInAccount, mocks.signOut, mocks.push, mocks.refresh]) {
    fn.mockReset()
  }
})
afterEach(cleanup)

describe('AccountMenu', () => {
  it('offers a visitor the sign-in and sign-up pages in both menus (#296)', async () => {
    mocks.getSignedInAccount.mockResolvedValue(null)
    render(header())

    expect(await screen.findAllByRole('link', { name: 'Log In' })).toHaveLength(2)
    const signUp = screen.getAllByRole('link', { name: 'Sign Up' })
    expect(signUp.map((link) => link.getAttribute('href'))).toEqual(['/sign-up', '/sign-up'])
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull()
  })

  it('holds the visitor links’ room in the bar while the server answers, hidden from everyone (#281)', async () => {
    let answer: (account: null) => void = () => {}
    mocks.getSignedInAccount.mockReturnValue(
      new Promise<null>((resolve) => {
        answer = resolve
      }),
    )
    render(header())

    // Nothing to click or read yet, so a visitor can't follow a link that may belong to someone else
    expect(screen.queryByRole('link', { name: 'Log In' })).toBeNull()
    const bar = screen.getByRole('navigation', { name: 'Bar' })
    const placeholder = bar.querySelector('[aria-hidden="true"]')
    expect(placeholder?.className).toContain('invisible')
    expect(placeholder?.textContent).toBe('Log InSign Up')
    expect(
      within(screen.getByRole('navigation', { name: 'Drawer' })).queryByText('Log In'),
    ).toBeNull()

    answer(null)
    expect(await screen.findAllByRole('link', { name: 'Log In' })).toHaveLength(2)
    expect(bar.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('shows the signed-in account’s name in both menus, asking the server once', async () => {
    mocks.getSignedInAccount.mockResolvedValue({ name: 'Ada', staff: false })
    render(header())

    const links = await screen.findAllByRole('link', { name: 'Ada' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/account', '/account'])
    expect(mocks.getSignedInAccount).toHaveBeenCalledTimes(1)
    // No sign-up offer for someone who already has an account
    expect(screen.queryByRole('link', { name: 'Sign Up' })).toBeNull()
  })

  it('links admins and editors to the admin from the mobile menu only, and nobody else (#378, #383)', async () => {
    mocks.getSignedInAccount.mockResolvedValue({ name: 'Ada', staff: true })
    render(header())
    const drawer = within(screen.getByRole('navigation', { name: 'Drawer' }))
    expect((await drawer.findByRole('link', { name: 'Dashboard' })).getAttribute('href')).toBe(
      '/admin',
    )
    // On desktop the admin bar has it
    expect(
      within(screen.getByRole('navigation', { name: 'Bar' })).queryByRole('link', {
        name: 'Dashboard',
      }),
    ).toBeNull()
    cleanup()

    mocks.getSignedInAccount.mockResolvedValue({ name: 'Ada', staff: false })
    render(header())
    await screen.findAllByRole('link', { name: 'Ada' })
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull()
  })

  it('calls an account without a name “Account”', async () => {
    mocks.getSignedInAccount.mockResolvedValue({ name: null, staff: false })
    render(header())
    expect(await screen.findAllByRole('link', { name: 'Account' })).toHaveLength(2)
  })

  it('asks again after every navigation, so signing in or out shows up', async () => {
    mocks.getSignedInAccount.mockResolvedValue(null)
    const { rerender } = render(header())
    await screen.findAllByRole('link', { name: 'Log In' })

    mocks.getSignedInAccount.mockResolvedValue({ name: 'Ada', staff: false })
    mocks.pathname = '/account'
    rerender(header())

    expect(await screen.findAllByRole('link', { name: 'Ada' })).toHaveLength(2)
    expect(mocks.getSignedInAccount).toHaveBeenCalledTimes(2)
  })

  it('signs out, then opens the home page as a visitor', async () => {
    mocks.getSignedInAccount.mockResolvedValue({ name: 'Ada', staff: false })
    mocks.signOut.mockResolvedValue(undefined)
    render(header())

    const bar = within(screen.getByRole('navigation', { name: 'Bar' }))
    await userEvent.click(await bar.findByRole('button', { name: 'Sign Out' }))

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/')
    expect(mocks.refresh).toHaveBeenCalled()
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Log In' })).toHaveLength(2))
  })
})
