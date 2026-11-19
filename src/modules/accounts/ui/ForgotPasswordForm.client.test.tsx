// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({ forgotPassword: vi.fn() }))
vi.mock('../actions', () => ({ forgotPassword: mocks.forgotPassword }))
// The robot check is on, and its widget hands out a fresh token after each reset
vi.mock(
  '@/platform/turnstile/TurnstileWidget.client',
  () => import('@/platform/turnstile/testing/fakeTurnstileWidget'),
)

import { FORGOT_PASSWORD_SENT, ForgotPasswordForm } from './ForgotPasswordForm.client'

beforeEach(() => {
  mocks.forgotPassword.mockReset()
})
afterEach(cleanup)

const send = async (email = 'ada@example.com') => {
  await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), email)
  await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
}

describe('ForgotPasswordForm', () => {
  it('sends only the email, then shows the same answer whatever the outcome', async () => {
    mocks.forgotPassword.mockResolvedValue({ ok: true })
    // In <main>, as on the page: the link back sits outside the form's landmark
    render(
      <main>
        <ForgotPasswordForm />
      </main>,
    )
    await expectAccessible(document.body)

    await send()

    expect(mocks.forgotPassword).toHaveBeenCalledExactlyOnceWith(
      { email: 'ada@example.com' },
      'token-0',
    )
    expect((await screen.findByRole('status')).textContent).toBe(FORGOT_PASSWORD_SENT)
    expect(FORGOT_PASSWORD_SENT).toBe(
      'No worries, it happens! If that email has an account, a reset link is on its way. It works for an hour. Nothing yet? Check your spam.',
    )
  })

  it('asks for an email before sending', async () => {
    render(<ForgotPasswordForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(mocks.forgotPassword).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your email address')).toBeTruthy()
  })

  it('says the site couldn’t be reached when the action gets no answer', async () => {
    mocks.forgotPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<ForgotPasswordForm />)
    await send()
    expect((await screen.findByRole('alert')).textContent).toMatch(/connection/)
  })

  it('explains a failed robot check or limit, and uses a fresh token every time', async () => {
    mocks.forgotPassword.mockResolvedValueOnce({ ok: false, failure: 'robot-check' })
    mocks.forgotPassword.mockResolvedValueOnce({ ok: true })
    mocks.forgotPassword.mockResolvedValueOnce({ ok: false, failure: 'too-many' })
    render(<ForgotPasswordForm />)
    await send()
    expect((await screen.findByRole('alert')).textContent).toMatch(/spam check/)
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect((await screen.findByRole('status')).textContent).toBe(FORGOT_PASSWORD_SENT)
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/try again in an hour/)
    expect(mocks.forgotPassword.mock.calls.map((call) => call[1])).toEqual([
      'token-0',
      'token-1',
      'token-2',
    ])
  })

  it('links back to the sign-in page', () => {
    render(<ForgotPasswordForm />)
    expect(screen.getByRole('link', { name: 'Back to log in' }).getAttribute('href')).toBe('/login')
  })
})
