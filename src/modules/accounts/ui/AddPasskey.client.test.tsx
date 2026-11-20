// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FORM_MESSAGES } from '@/platform/ui'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({
  getPasskeyOptions: vi.fn(),
  addPasskey: vi.fn(),
  signOut: vi.fn(),
  createPasskey: vi.fn(),
  passkeysSupported: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('../actions', () => ({
  getPasskeyOptions: mocks.getPasskeyOptions,
  addPasskey: mocks.addPasskey,
  signOut: mocks.signOut,
}))
vi.mock('./passkeyBrowser', () => ({
  createPasskey: mocks.createPasskey,
  passkeysSupported: mocks.passkeysSupported,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { AddPasskey } from './AddPasskey.client'

const options = { challenge: 'c' }
const answer = { id: 'abc' }

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
  mocks.passkeysSupported.mockResolvedValue(true)
  mocks.getPasskeyOptions.mockResolvedValue({ ok: true, options })
  mocks.createPasskey.mockResolvedValue({ ok: true, answer })
  mocks.addPasskey.mockResolvedValue({ ok: true })
  mocks.signOut.mockResolvedValue(undefined)
})
afterEach(cleanup)

const shown = async () => {
  render(<AddPasskey />)
  return screen.findByRole('button', { name: 'Add a passkey' })
}
const add = async () => userEvent.click(await shown())

describe('AddPasskey: when it shows', () => {
  it('shows nothing until the browser says it can make a passkey, and nothing if it can’t', async () => {
    mocks.passkeysSupported.mockResolvedValue(false)
    const { container } = render(<AddPasskey />)
    await waitFor(() => expect(mocks.passkeysSupported).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Passkeys')).toBeNull()
  })

  it('shows the card with its lead, a name field and the button, and is accessible', async () => {
    await shown()
    expect(screen.getByRole('heading', { name: 'Passkeys' })).toBeTruthy()
    expect(
      screen.getByText(
        'Sign in with your phone’s or computer’s screen lock instead of a password.',
      ),
    ).toBeTruthy()
    const name = screen.getByLabelText<HTMLInputElement>(/^Passkey name/)
    expect(name.maxLength).toBe(60)
    expect(name.autocomplete).toBe('off')
    expect(screen.getByText('Optional. It helps you tell your passkeys apart.')).toBeTruthy()
    await expectAccessible(document.body)
  })
})

describe('AddPasskey: adding one', () => {
  it('asks for the options, shows the browser prompt, sends the answer with the name, and says so', async () => {
    await shown()
    await userEvent.type(screen.getByLabelText(/^Passkey name/), 'My phone')
    await userEvent.click(screen.getByRole('button', { name: 'Add a passkey' }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('Passkey added. Next time, choose Sign in with a passkey.')
    expect(mocks.createPasskey).toHaveBeenCalledExactlyOnceWith(options)
    expect(mocks.addPasskey).toHaveBeenCalledExactlyOnceWith({ answer, label: 'My phone' })
    expect(screen.getByLabelText<HTMLInputElement>(/^Passkey name/).value).toBe('')
    await expectAccessible(document.body)
  })

  it('adds with Enter in the name field too', async () => {
    await shown()
    await userEvent.type(screen.getByLabelText(/^Passkey name/), 'Laptop{Enter}')
    await screen.findByRole('status')
    expect(mocks.addPasskey).toHaveBeenCalledExactlyOnceWith({ answer, label: 'Laptop' })
  })

  it('keeps the button busy while it works, so a second tap adds nothing', async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.getPasskeyOptions.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const button = await shown()
    await userEvent.click(button)
    expect(button.getAttribute('aria-busy')).toBe('true')
    await userEvent.click(button)
    expect(mocks.getPasskeyOptions).toHaveBeenCalledOnce()
    finish({ ok: false, failure: 'failed' })
    await screen.findByRole('alert')
    expect(button.getAttribute('aria-busy')).toBeNull()
  })

  it('says nothing went wrong when the prompt is closed, and sends nothing', async () => {
    mocks.createPasskey.mockResolvedValue({ ok: false, reason: 'cancelled' })
    await add()
    expect((await screen.findByRole('status')).textContent).toContain(
      'No passkey was added. You can try again any time.',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mocks.addPasskey).not.toHaveBeenCalled()
  })

  it('says so when this device already has a passkey for the account', async () => {
    mocks.createPasskey.mockResolvedValue({ ok: false, reason: 'already-here' })
    await add()
    expect((await screen.findByRole('status')).textContent).toContain(
      'This device already has a passkey for your account.',
    )
  })

  it.each([
    [
      'the browser can’t make it',
      () => mocks.createPasskey.mockResolvedValue({ ok: false, reason: 'failed' }),
      'We couldn’t add that passkey. Please try again.',
    ],
    [
      'the server refuses the answer',
      () => mocks.addPasskey.mockResolvedValue({ ok: false, failure: 'failed' }),
      'We couldn’t add that passkey. Please try again.',
    ],
    [
      'too many requests',
      () => mocks.getPasskeyOptions.mockResolvedValue({ ok: false, failure: 'too-many' }),
      'Too many requests right now. Please try again in an hour.',
    ],
    [
      'the request gets no answer',
      () => mocks.getPasskeyOptions.mockRejectedValue(new Error('network')),
      FORM_MESSAGES.offline,
    ],
  ])('shows one fixed error when %s', async (_name, arrange, text) => {
    arrange()
    await add()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(text)
    expect(alert.textContent).not.toContain('network')
    await expectAccessible(document.body)
  })

  it('tells a neighbor at the most passkeys to remove one, as a warning', async () => {
    mocks.getPasskeyOptions.mockResolvedValue({ ok: false, failure: 'cap' })
    await add()
    expect((await screen.findByRole('status')).textContent).toContain(
      'You have as many passkeys as we can keep. Remove one to add another.',
    )
    expect(screen.queryByRole('button', { name: 'Log in again' })).toBeNull()
  })
})

describe('AddPasskey: an old sign-in', () => {
  const askToLogInAgain = async () => {
    mocks.getPasskeyOptions.mockResolvedValue({ ok: false, failure: 'sign-in-again' })
    await add()
    return screen.findByRole('button', { name: 'Log in again' })
  }

  it('asks kindly to log in again, with a button that does it', async () => {
    const button = await askToLogInAgain()
    expect(screen.getByRole('status').textContent).toContain(
      'To keep your account safe, please log in again first. Then you can add a passkey.',
    )
    expect(mocks.createPasskey).not.toHaveBeenCalled()
    await expectAccessible(document.body)

    await userEvent.click(button)
    expect(mocks.signOut).toHaveBeenCalledOnce()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/login'))
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('stays on the page and says so when signing out gets no answer', async () => {
    const button = await askToLogInAgain()
    mocks.signOut.mockRejectedValue(new Error('network'))
    await userEvent.click(button)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(FORM_MESSAGES.offline),
    )
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('also asks when the server turns the answer away for an old sign-in', async () => {
    mocks.addPasskey.mockResolvedValue({ ok: false, failure: 'sign-in-again' })
    await add()
    expect(await screen.findByRole('button', { name: 'Log in again' })).toBeTruthy()
  })
})
