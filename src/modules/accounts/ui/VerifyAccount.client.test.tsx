// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeTurnstile } from '@/platform/turnstile/testing/fakeTurnstileWidget'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({ verifyAccount: vi.fn() }))
vi.mock('../actions', () => ({ verifyAccount: mocks.verifyAccount }))
vi.mock(
  '@/platform/turnstile/TurnstileWidget.client',
  () => import('@/platform/turnstile/testing/fakeTurnstileWidget'),
)

import { VerifyAccount } from './VerifyAccount.client'

const TOKEN = '0123456789abcdef0123456789abcdef01234567'

beforeEach(() => {
  fakeTurnstile.tokenFor = (reset) => `token-${reset}`
  mocks.verifyAccount.mockReset()
  window.history.replaceState(null, '', `/verify-account?token=${TOKEN}`)
})
afterEach(cleanup)

const clickConfirm = () =>
  userEvent.click(screen.getByRole('button', { name: 'Confirm My Account' }))

describe('VerifyAccount', () => {
  it('does nothing until the button is clicked, then verifies and offers to log in', async () => {
    mocks.verifyAccount.mockResolvedValue({ ok: true })
    render(
      <main>
        <VerifyAccount token={TOKEN} status="pending" />
      </main>,
    )
    await expectAccessible(document.body)
    expect(window.location.search).toBe('')
    expect(mocks.verifyAccount).not.toHaveBeenCalled()

    await clickConfirm()

    expect(mocks.verifyAccount).toHaveBeenCalledExactlyOnceWith({ token: TOKEN }, 'token-0')
    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/account is ready/)
    expect(status.parentElement?.contains(document.activeElement)).toBe(true)
    expect(screen.getByRole('link', { name: 'Log In' }).getAttribute('href')).toBe('/login')
    await expectAccessible(document.body)
  })

  it('says a used or unknown link is dead, and offers to log in', async () => {
    mocks.verifyAccount.mockResolvedValue({ ok: false, failure: 'invalid-link' })
    render(<VerifyAccount token={TOKEN} status="pending" />)
    await clickConfirm()
    expect((await screen.findByRole('alert')).textContent).toMatch(/already used/)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('link', { name: 'Log In' })).toBeTruthy()
  })

  it('keeps the button to try again after a server error or no answer', async () => {
    mocks.verifyAccount.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<VerifyAccount token={TOKEN} status="pending" />)
    await clickConfirm()
    expect((await screen.findByRole('alert')).textContent).toMatch(/connection/)
    expect(screen.getByRole('button', { name: 'Confirm My Account' })).toBeTruthy()
  })

  it('asks for a password on a resent link, then sets it and verifies in one step (#289)', async () => {
    mocks.verifyAccount.mockResolvedValueOnce({ ok: false, failure: 'needs-password' })
    mocks.verifyAccount.mockResolvedValueOnce({ ok: true })
    render(
      <main>
        <VerifyAccount token={TOKEN} status="pending" />
      </main>,
    )
    await clickConfirm()

    expect(await screen.findByText(/Choose a password to finish/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm My Account' })).toBeNull()
    await expectAccessible(document.body)

    await userEvent.type(screen.getByLabelText(/^Password/), 'correct-horse')
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'correct-horse')
    await userEvent.click(screen.getByRole('button', { name: 'Set Password and Confirm' }))

    expect(mocks.verifyAccount).toHaveBeenLastCalledWith(
      { token: TOKEN, newPassword: 'correct-horse', confirmPassword: 'correct-horse' },
      'token-1', // a fresh robot-check token for the second request
    )
    expect((await screen.findByRole('status')).textContent).toMatch(/account is ready/)
    expect(screen.getByRole('link', { name: 'Log In' }).getAttribute('href')).toBe('/login')
  })

  it('checks the chosen passwords match before sending', async () => {
    mocks.verifyAccount.mockResolvedValue({ ok: false, failure: 'needs-password' })
    render(<VerifyAccount token={TOKEN} status="pending" />)
    await clickConfirm()
    await userEvent.type(await screen.findByLabelText(/^Password/), 'correct-horse')
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'other-horse')
    await userEvent.click(screen.getByRole('button', { name: 'Set Password and Confirm' }))
    expect(await screen.findByText('The passwords don’t match')).toBeTruthy()
    expect(mocks.verifyAccount).toHaveBeenCalledTimes(1)
  })

  it('sends nothing while the robot check is still running, and says why (#303)', async () => {
    fakeTurnstile.tokenFor = () => null
    render(<VerifyAccount token={TOKEN} status="pending" />)
    await clickConfirm()
    expect(mocks.verifyAccount).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/spam check is still running/)
  })

  it('says when the robot check fails, and keeps the button to try again', async () => {
    mocks.verifyAccount.mockResolvedValue({ ok: false, failure: 'robot-check' })
    render(<VerifyAccount token={TOKEN} status="pending" />)
    await clickConfirm()
    expect((await screen.findByRole('alert')).textContent).toMatch(/spam check didn’t pass/)
    expect(screen.getByRole('button', { name: 'Confirm My Account' })).toBeTruthy()
  })

  it('shows a link with no token as dead, without asking the server', () => {
    render(<VerifyAccount token={null} status="invalid" />)
    expect(screen.getByRole('alert').textContent).toMatch(/isn’t valid/)
    expect(mocks.verifyAccount).not.toHaveBeenCalled()
  })

  describe('when the link was already used as the page opens (#391)', () => {
    it('says the account is already confirmed and offers to log in, with no Confirm button', async () => {
      render(
        <main>
          <VerifyAccount token={TOKEN} status="already-verified" />
        </main>,
      )
      expect(screen.getByRole('status').textContent).toMatch(/already confirmed/)
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.getByRole('link', { name: 'Log In' }).getAttribute('href')).toBe('/login')
      expect(mocks.verifyAccount).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(document.body)
      await expectAccessible(document.body)
    })

    it('says a link no account holds is dead, with no Confirm button', () => {
      render(<VerifyAccount token={TOKEN} status="invalid" />)
      expect(screen.getByRole('alert').textContent).toMatch(/already used/)
      expect(screen.queryByRole('button')).toBeNull()
      expect(mocks.verifyAccount).not.toHaveBeenCalled()
    })

    it('says so too when the button finds the link already used', async () => {
      mocks.verifyAccount.mockResolvedValue({ ok: false, failure: 'already-verified' })
      render(<VerifyAccount token={TOKEN} status="pending" />)
      await clickConfirm()
      expect((await screen.findByRole('status')).textContent).toMatch(/already confirmed/)
      expect(screen.queryByRole('button')).toBeNull()
    })
  })
})
