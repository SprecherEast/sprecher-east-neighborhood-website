// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('../actions', () => ({ signUp: mocks.signUp }))
// The robot check is on, and its widget hands out a fresh token after each reset
vi.mock(
  '@/platform/turnstile/TurnstileWidget.client',
  () => import('@/platform/turnstile/testing/fakeTurnstileWidget'),
)

import { SignUpForm } from './SignUpForm.client'
import { SIGN_UP_SENT } from './signUpMessages'

beforeEach(() => {
  mocks.signUp.mockReset()
  window.history.replaceState(null, '', '/sign-up?email=ana%40example.com')
})
afterEach(cleanup)

const fill = async (password = 'correct-horse') => {
  await userEvent.type(screen.getByRole('textbox', { name: /Name/ }), 'Ana')
  await userEvent.type(screen.getByLabelText(/^Password/), password)
  await userEvent.type(screen.getByLabelText(/Confirm password/), password)
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

describe('SignUpForm', () => {
  it('fills in the email, takes it out of the address bar, and sends the form', async () => {
    mocks.signUp.mockResolvedValue({ ok: true })
    render(
      <main>
        <SignUpForm email="ana@example.com" />
      </main>,
    )
    await expectAccessible(document.body)
    expect(window.location.search).toBe('')
    expect((screen.getByRole('textbox', { name: /Email/ }) as HTMLInputElement).value).toBe(
      'ana@example.com',
    )

    await fill()
    await submit()

    expect(mocks.signUp).toHaveBeenCalledExactlyOnceWith(
      {
        name: 'Ana',
        email: 'ana@example.com',
        newPassword: 'correct-horse',
        confirmPassword: 'correct-horse',
      },
      'token-0',
    )
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe(SIGN_UP_SENT)
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.getByRole('link', { name: 'Go to log in' }).getAttribute('href')).toBe('/login')
  })

  it('checks the fields before sending', async () => {
    render(<SignUpForm email={null} />)
    await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'not-an-email')
    await submit()
    expect(mocks.signUp).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your name')).toBeTruthy()
    expect(screen.getByText('Enter one email address')).toBeTruthy()
  })

  it('says the site couldn’t be reached when the action gets no answer', async () => {
    mocks.signUp.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<SignUpForm email="ana@example.com" />)
    await fill()
    await submit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/connection/)
  })

  it('explains a failed robot check or limit, and retries with a fresh token', async () => {
    mocks.signUp.mockResolvedValueOnce({ ok: false, failure: 'robot-check' })
    mocks.signUp.mockResolvedValueOnce({ ok: false, failure: 'too-many' })
    render(<SignUpForm email="ana@example.com" />)
    await fill()
    await submit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/spam check/)
    await submit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/try again in an hour/)
    expect(mocks.signUp.mock.calls.map((call) => call[1])).toEqual(['token-0', 'token-1'])
  })

  it('links to the sign-in page for people who already have an account', () => {
    render(<SignUpForm email={null} />)
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
  })
})

describe('SignUpForm: the quick way in (#1365)', () => {
  it('puts Google above the form, with one divider line between them', async () => {
    render(
      <main>
        <SignUpForm email={null} social={<button type="button">Continue with Google</button>} />
      </main>,
    )
    const google = screen.getByRole('button', { name: 'Continue with Google' })
    const divider = screen.getByText('Or use your email and password')
    const name = screen.getByRole('textbox', { name: /Name/ })
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(before(google, divider)).toBe(true)
    expect(before(divider, name)).toBe(true)
    await expectAccessible(document.body)
  })

  it('leaves no group or divider showing when there is no quick way', () => {
    const { container } = render(<SignUpForm email={null} />)
    const list = container.querySelector('[data-sign-in-methods]')

    expect(list?.childElementCount).toBe(0)
    expect(list?.parentElement?.className).toContain('has-[>[data-sign-in-methods]:empty]:hidden')
  })
})
