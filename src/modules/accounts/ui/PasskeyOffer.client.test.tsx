// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FORM_MESSAGES } from '@/platform/ui'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { PASSKEY_OFFER_SNOOZE_MS, passkeyOfferSnoozeUntil } from '../domain/passkeyOffer'

const mocks = vi.hoisted(() => ({
  addAPasskey: vi.fn(),
  signOut: vi.fn(),
  passkeysSupported: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('./addAPasskey', () => ({ addAPasskey: mocks.addAPasskey }))
vi.mock('../actions', () => ({ signOut: mocks.signOut }))
vi.mock('./passkeyBrowser', () => ({ passkeysSupported: mocks.passkeysSupported }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { PasskeyOffer, PASSKEY_OFFER_STORAGE_KEY } from './PasskeyOffer.client'
import { toAddPasskeyNotice } from './passkeyMessages'

const ADD = 'Set up a passkey'

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
  mocks.passkeysSupported.mockResolvedValue(true)
  mocks.addAPasskey.mockResolvedValue('added')
  mocks.signOut.mockResolvedValue(undefined)
  localStorage.clear()
})
afterEach(cleanup)

const shown = () => screen.findByRole('button', { name: ADD })

describe('PasskeyOffer: who is offered', () => {
  it('offers one clear button and a way to say not now, in plain words, and is accessible', async () => {
    const { container } = render(<PasskeyOffer eligible />)
    await shown()
    expect(screen.getByRole('heading', { name: 'Log in faster next time' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy()
    expect(container.textContent).toContain(
      'Set up a passkey on this device, then log in with your fingerprint, face or screen lock instead of a password.',
    )
    await expectAccessible(container)
  })

  it('offers nothing to a neighbor who already has a passkey', async () => {
    const { container } = render(<PasskeyOffer eligible={false} />)
    await waitFor(() => expect(mocks.passkeysSupported).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  it('offers nothing when the browser can’t make a passkey', async () => {
    mocks.passkeysSupported.mockResolvedValue(false)
    const { container } = render(<PasskeyOffer eligible />)
    await waitFor(() => expect(mocks.passkeysSupported).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  it('offers nothing while a “Not now” still holds, and again once its time is up', async () => {
    localStorage.setItem(PASSKEY_OFFER_STORAGE_KEY, passkeyOfferSnoozeUntil(Date.now()))
    const { container, unmount } = render(<PasskeyOffer eligible />)
    await waitFor(() => expect(mocks.passkeysSupported).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
    unmount()

    localStorage.setItem(PASSKEY_OFFER_STORAGE_KEY, String(Date.now() - 1))
    render(<PasskeyOffer eligible />)
    await shown()
  })

  it('still offers when the browser won’t let the page read its storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<PasskeyOffer eligible />)
    await shown()
    vi.restoreAllMocks()
  })
})

describe('PasskeyOffer: “Not now”', () => {
  it('hides the offer, remembers it for a month, and says where to add one later', async () => {
    const before = Date.now()
    render(<PasskeyOffer eligible />)
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(screen.queryByRole('button', { name: ADD })).toBeNull()
    const note = screen.getByText('No problem. You can add a passkey any time in the card below.')
    // Keyboard and screen reader users are put on the answer, as the button they pressed is gone
    expect(document.activeElement).toBe(note)
    const stored = Number(localStorage.getItem(PASSKEY_OFFER_STORAGE_KEY))
    expect(stored).toBeGreaterThanOrEqual(before + PASSKEY_OFFER_SNOOZE_MS)
    expect(mocks.addAPasskey).not.toHaveBeenCalled()
  })

  it('does not offer again on the next visit', async () => {
    const { unmount } = render(<PasskeyOffer eligible />)
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    unmount()

    const { container } = render(<PasskeyOffer eligible />)
    await waitFor(() => expect(mocks.passkeysSupported).toHaveBeenCalledTimes(2))
    expect(container.innerHTML).toBe('')
  })

  it('hides the offer for this visit even when the browser won’t keep the answer', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    render(<PasskeyOffer eligible />)
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('button', { name: ADD })).toBeNull()
    vi.restoreAllMocks()
  })
})

describe('PasskeyOffer: adding one', () => {
  it('adds a passkey with no name, then says so and keeps saying it after the page refreshes', async () => {
    const { rerender } = render(<PasskeyOffer eligible />)
    await userEvent.click(await shown())

    expect(mocks.addAPasskey).toHaveBeenCalledWith('')
    expect((await screen.findByRole('status')).textContent).toContain(
      'Passkey added. Next time, choose Log in with a passkey.',
    )
    expect(mocks.refresh).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: ADD })).toBeNull()

    // The page refreshes: the account now has a passkey, so it is no longer eligible
    rerender(<PasskeyOffer eligible={false} />)
    expect(screen.getByRole('status').textContent).toContain('Passkey added.')
    // Having one is the answer: nothing is remembered for later
    expect(localStorage.getItem(PASSKEY_OFFER_STORAGE_KEY)).toBeNull()
  })

  it('keeps the offer when the browser’s box is closed, says so, and can be tried again', async () => {
    mocks.addAPasskey.mockResolvedValueOnce('cancelled')
    render(<PasskeyOffer eligible />)
    await userEvent.click(await shown())

    expect((await screen.findByRole('status')).textContent).toContain('No passkey was added.')
    expect(mocks.refresh).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: ADD }))
    await waitFor(() => expect(mocks.addAPasskey).toHaveBeenCalledTimes(2))
  })

  it('does not start a second prompt while one is open', async () => {
    let finish: (outcome: 'added') => void = () => {}
    mocks.addAPasskey.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    render(<PasskeyOffer eligible />)
    const button = await shown()
    await userEvent.click(button)
    await userEvent.click(button)
    expect(mocks.addAPasskey).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-busy')).toBe('true')
    finish('added')
    await screen.findByRole('status')
  })

  it.each([
    ['failed', toAddPasskeyNotice('failed').text],
    ['offline', FORM_MESSAGES.offline],
  ] as const)(
    'shows a fixed message when it ends %s, and the offer stays',
    async (outcome, text) => {
      mocks.addAPasskey.mockResolvedValue(outcome)
      render(<PasskeyOffer eligible />)
      await userEvent.click(await shown())
      expect((await screen.findByRole('alert')).textContent).toContain(text)
      expect(screen.getByRole('button', { name: ADD })).toBeTruthy()
    },
  )

  it('asks to log in again, as the card does, when the sign-in is too old', async () => {
    mocks.addAPasskey.mockResolvedValue('sign-in-again')
    render(<PasskeyOffer eligible />)
    await userEvent.click(await shown())
    expect((await screen.findByRole('status')).textContent).toContain('please log in again')
    await userEvent.click(screen.getByRole('button', { name: /log in again/i }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/login'))
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it('is reachable by keyboard in reading order: the button, then not now', async () => {
    render(<PasskeyOffer eligible />)
    await shown()
    await userEvent.tab()
    expect(document.activeElement?.textContent).toBe(ADD)
    await userEvent.tab()
    expect(document.activeElement?.textContent).toBe('Not now')
  })
})
