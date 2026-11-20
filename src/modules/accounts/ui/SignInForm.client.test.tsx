// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('../actions', () => ({ signIn: mocks.signIn }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

// The passkey button is tested on its own (`PasskeySignIn.client.test.tsx`); here it only shows
// what the form hands it
vi.mock('./PasskeySignIn.client', () => ({
  PasskeySignIn: ({ rememberMe }: { rememberMe: boolean }) => (
    <button type="button" data-remember={String(rememberMe)}>
      Log in with a passkey
    </button>
  ),
}))

import { SignInForm } from './SignInForm.client'

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
  // jsdom has no ResizeObserver, which Radix Checkbox uses inside a form
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(cleanup)

const fillAndSend = async () => {
  await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'ada@example.com')
  await userEvent.type(screen.getByLabelText(/Password/), 'secret-pass')
  await userEvent.click(screen.getByRole('button', { name: 'Log In' }))
}

describe('SignInForm', () => {
  it('signs in with what was typed and opens the account page', async () => {
    mocks.signIn.mockResolvedValue({ ok: true })
    // In <main>, as on the page: the sign-up line sits outside the form's landmark
    render(
      <main>
        <SignInForm />
      </main>,
    )
    await expectAccessible(document.body)

    await fillAndSend()

    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'secret-pass',
      rememberMe: false,
    })
    expect(mocks.push).toHaveBeenCalledWith('/account')
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('offers "Keep me signed in", unticked, and says how long it lasts (#587)', () => {
    render(<SignInForm />)
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in for 7 days' })
    expect(box.getAttribute('aria-checked')).toBe('false')
  })

  it('asks for the long sign-in when the box is ticked (#587)', async () => {
    mocks.signIn.mockResolvedValue({ ok: true })
    render(<SignInForm />)

    await userEvent.click(screen.getByRole('checkbox', { name: /Keep me signed in/ }))
    await fillAndSend()

    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'secret-pass',
      rememberMe: true,
    })
  })

  it.each([
    ['wrong-credentials', 'Invalid email or password. Please try again.'],
    ['server-error', 'Something went wrong on our side. Please try again in a few minutes.'],
  ])('shows the fixed message for %s and stays on the page', async (failure, message) => {
    mocks.signIn.mockResolvedValue({ ok: false, failure })
    render(<SignInForm />)

    await fillAndSend()

    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('says the site couldn’t be reached when the action gets no answer', async () => {
    mocks.signIn.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<SignInForm />)

    await fillAndSend()

    expect((await screen.findByRole('alert')).textContent).toMatch(/connection/)
  })

  it('links to the page that sends a reset link', () => {
    render(<SignInForm />)
    const link = screen.getByRole('link', { name: 'Forgot your password?' })
    expect(link.getAttribute('href')).toBe('/forgot-password')
  })

  it('links visitors without an account to the sign-up page (#296)', () => {
    render(<SignInForm />)
    const link = screen.getByRole('link', { name: 'Sign up' })
    expect(link.getAttribute('href')).toBe('/sign-up')
  })

  it('keeps an email typed before the page finished loading', async () => {
    mocks.signIn.mockResolvedValue({ ok: true })
    const container = document.body.appendChild(document.createElement('div'))
    container.innerHTML = renderToString(<SignInForm />)
    const email = screen.getByRole<HTMLInputElement>('textbox', { name: /Email/ })
    email.value = 'early@example.com'

    const root = await act(async () => hydrateRoot(container, <SignInForm />))

    expect(email.value).toBe('early@example.com')
    act(() => root.unmount())
    container.remove()
  })
})

describe('SignInForm with passkeys (#1315)', () => {
  it('shows nothing about passkeys, and the email field as it was, when the switch is off', () => {
    render(<SignInForm />)
    expect(screen.queryByRole('button', { name: /passkey/ })).toBeNull()
    expect(screen.getByRole('textbox', { name: /Email/ }).getAttribute('autocomplete')).toBe(
      'email',
    )
  })

  it('offers the passkey button under "Log In", and the passkey in the email field’s autofill, when on', async () => {
    render(
      <main>
        <SignInForm passkeys />
      </main>,
    )
    const passkey = await screen.findByRole('button', { name: 'Log in with a passkey' })
    const logIn = screen.getByRole('button', { name: 'Log In' })
    // Under the button that sends the form, and not a way of sending it
    expect(logIn.compareDocumentPosition(passkey) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(passkey.getAttribute('type')).toBe('button')
    expect(screen.getByRole('textbox', { name: /Email/ }).getAttribute('autocomplete')).toBe(
      'username webauthn',
    )
    await expectAccessible(document.body)
  })

  it('tells the button whether "Keep me signed in" is ticked', async () => {
    render(<SignInForm passkeys />)
    const passkey = await screen.findByRole('button', { name: 'Log in with a passkey' })
    expect(passkey.getAttribute('data-remember')).toBe('false')
    await userEvent.click(screen.getByRole('checkbox', { name: /Keep me signed in/ }))
    expect(passkey.getAttribute('data-remember')).toBe('true')
  })

  it('does not send the password form when the passkey button is pressed', async () => {
    render(<SignInForm passkeys />)
    await userEvent.click(await screen.findByRole('button', { name: 'Log in with a passkey' }))
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
})
