// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FORM_MESSAGES } from '@/platform/ui'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({
  getPasskeyLoginOptions: vi.fn(),
  logInWithPasskey: vi.fn(),
  getPasskey: vi.fn(),
  passkeysSupported: vi.fn(),
  passkeyAutofillSupported: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('../actions', () => ({
  getPasskeyLoginOptions: mocks.getPasskeyLoginOptions,
  logInWithPasskey: mocks.logInWithPasskey,
}))
vi.mock('./passkeyBrowser', () => ({
  getPasskey: mocks.getPasskey,
  passkeysSupported: mocks.passkeysSupported,
  passkeyAutofillSupported: mocks.passkeyAutofillSupported,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { PasskeySignIn } from './PasskeySignIn.client'

const options = { challenge: 'c' }
const answer = { id: 'abc' }
const FAILED_TEXT =
  'We couldn’t log you in with that passkey. Try again, or use your email and password.'

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
  mocks.passkeysSupported.mockResolvedValue(true)
  mocks.passkeyAutofillSupported.mockResolvedValue(false)
  mocks.getPasskeyLoginOptions.mockResolvedValue({ ok: true, options })
  mocks.getPasskey.mockResolvedValue({ ok: true, answer })
  mocks.logInWithPasskey.mockResolvedValue({ ok: true })
})
afterEach(cleanup)

const shown = async (rememberMe = false) => {
  render(<PasskeySignIn rememberMe={rememberMe} />)
  return screen.findByRole('button', { name: 'Log in with a passkey' })
}
const press = async (rememberMe = false) => userEvent.click(await shown(rememberMe))

describe('PasskeySignIn: when it shows', () => {
  it('shows nothing if the browser can’t use a passkey, and no prompt is ever started', async () => {
    mocks.passkeysSupported.mockResolvedValue(false)
    const { container } = render(<PasskeySignIn rememberMe={false} />)
    await waitFor(() => expect(container.innerHTML).toBe(''))
    expect(mocks.getPasskeyLoginOptions).not.toHaveBeenCalled()
  })

  it('holds the button’s room, unseen and out of reach, while the browser is asked, so the page below does not jump (#1365)', async () => {
    let answer: (supported: boolean) => void = () => {}
    mocks.passkeysSupported.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)))
    const { container } = render(<PasskeySignIn rememberMe={false} />)

    // Same size as the real button (it is the real button), but invisible: not focusable, not read
    expect(container.querySelector('.invisible')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Log in with a passkey' })).toBeNull()

    answer(true)
    expect(await screen.findByRole('button', { name: 'Log in with a passkey' })).toBeTruthy()
    expect(container.querySelector('.invisible')).toBeNull()
  })

  it('shows one button, with the verb the rest of the log in page uses, and is accessible', async () => {
    const button = await shown()
    expect(button.getAttribute('type')).toBe('button')
    // Full width, and the kit's own 44 px tall button
    expect(button.className).toMatch(/w-full/)
    await expectAccessible(document.body)
  })
})

describe('PasskeySignIn: logging in', () => {
  it('asks for options, shows the browser’s prompt, sends its answer, and opens the account', async () => {
    await press()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'))
    expect(mocks.getPasskeyLoginOptions).toHaveBeenCalledOnce()
    expect(mocks.getPasskey).toHaveBeenCalledExactlyOnceWith(options, { autofill: false })
    expect(mocks.logInWithPasskey).toHaveBeenCalledExactlyOnceWith({ answer, rememberMe: false })
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('sends "Keep me signed in" as the form has it at that moment', async () => {
    await press(true)
    await waitFor(() => expect(mocks.logInWithPasskey).toHaveBeenCalled())
    expect(mocks.logInWithPasskey).toHaveBeenCalledWith({ answer, rememberMe: true })
  })

  it('says nothing when the prompt is closed, and the button works again', async () => {
    mocks.getPasskey.mockResolvedValueOnce({ ok: false, reason: 'cancelled' })
    await press()
    await waitFor(() => expect(mocks.getPasskey).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mocks.logInWithPasskey).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Log in with a passkey' }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'))
  })

  it.each([
    [
      'the server refuses the answer',
      () => mocks.logInWithPasskey.mockResolvedValue({ ok: false, failure: 'failed' }),
      FAILED_TEXT,
    ],
    [
      'the browser fails',
      () => mocks.getPasskey.mockResolvedValue({ ok: false, reason: 'failed' }),
      FAILED_TEXT,
    ],
    [
      'the options are refused',
      () => mocks.getPasskeyLoginOptions.mockResolvedValue({ ok: false, failure: 'failed' }),
      FAILED_TEXT,
    ],
    [
      'there are too many requests',
      () => mocks.getPasskeyLoginOptions.mockResolvedValue({ ok: false, failure: 'too-many' }),
      'Too many requests right now. Please try again in an hour.',
    ],
    [
      'the request gets no answer',
      () => mocks.logInWithPasskey.mockRejectedValue(new Error('network')),
      FORM_MESSAGES.offline,
    ],
  ])('shows one fixed message when %s, and stays on the page', async (_name, arrange, text) => {
    arrange()
    await press()
    expect((await screen.findByRole('alert')).textContent).toContain(text)
    expect(mocks.push).not.toHaveBeenCalled()
    await expectAccessible(document.body)
  })

  it('never shows what the server or the browser said', async () => {
    mocks.logInWithPasskey.mockResolvedValue({
      ok: false,
      failure: 'no such account for ada@example.com',
    })
    await press()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toContain('ada@example.com')
    expect(alert.textContent).toContain('We couldn’t log you in')
  })

  it('does not start a second prompt while one is going', async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.logInWithPasskey.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const button = await shown()
    await userEvent.click(button)
    await waitFor(() => expect(mocks.logInWithPasskey).toHaveBeenCalled())
    await userEvent.click(button)
    expect(mocks.getPasskeyLoginOptions).toHaveBeenCalledOnce()
    finish({ ok: true })
    await waitFor(() => expect(mocks.push).toHaveBeenCalled())
  })
})

describe('PasskeySignIn: the email field’s autofill', () => {
  beforeEach(() => {
    mocks.passkeyAutofillSupported.mockResolvedValue(true)
  })

  it('waits in the autofill list when the browser supports it, and logs in when a passkey is picked', async () => {
    render(<PasskeySignIn rememberMe={false} />)
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'))
    expect(mocks.getPasskey).toHaveBeenCalledExactlyOnceWith(options, { autofill: true })
    expect(mocks.logInWithPasskey).toHaveBeenCalledExactlyOnceWith({ answer, rememberMe: false })
  })

  it('sends the "Keep me signed in" box as it is when the passkey is picked, not as it was at load', async () => {
    let pick: (value: unknown) => void = () => {}
    mocks.getPasskey.mockReturnValue(new Promise((resolve) => (pick = resolve)))
    const { rerender } = render(<PasskeySignIn rememberMe={false} />)
    await waitFor(() => expect(mocks.getPasskey).toHaveBeenCalled())
    rerender(<PasskeySignIn rememberMe />)
    pick({ ok: true, answer })
    await waitFor(() => expect(mocks.logInWithPasskey).toHaveBeenCalled())
    expect(mocks.logInWithPasskey).toHaveBeenCalledWith({ answer, rememberMe: true })
  })

  it('stays quiet when the autofill request ends without a pick, fails, or is refused', async () => {
    mocks.getPasskey.mockResolvedValue({ ok: false, reason: 'failed' })
    render(<PasskeySignIn rememberMe={false} />)
    await waitFor(() => expect(mocks.getPasskey).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()

    cleanup()
    mocks.getPasskeyLoginOptions.mockResolvedValue({ ok: false, failure: 'too-many' })
    mocks.getPasskey.mockClear()
    render(<PasskeySignIn rememberMe={false} />)
    await waitFor(() => expect(mocks.getPasskeyLoginOptions).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mocks.getPasskey).not.toHaveBeenCalled()
  })

  it('says so when the server refuses the passkey that was picked', async () => {
    mocks.logInWithPasskey.mockResolvedValue({ ok: false, failure: 'failed' })
    render(<PasskeySignIn rememberMe={false} />)
    expect((await screen.findByRole('alert')).textContent).toContain(FAILED_TEXT)
  })

  it('does not wait in autofill when the browser can’t offer it, and the button still works', async () => {
    mocks.passkeyAutofillSupported.mockResolvedValue(false)
    await shown()
    expect(mocks.getPasskeyLoginOptions).not.toHaveBeenCalled()
  })
})
