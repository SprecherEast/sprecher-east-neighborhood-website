// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FORM_MESSAGES } from '@/platform/ui'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PasskeyListItem } from '../domain/removePasskey'

const mocks = vi.hoisted(() => ({
  removePasskey: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('../actions', () => ({ removePasskey: mocks.removePasskey, signOut: mocks.signOut }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { PasskeyList } from './PasskeyList.client'

const phone: PasskeyListItem = {
  id: 1,
  label: 'My phone',
  addedAt: '2026-01-03T15:00:00.000Z',
  lastUsedAt: '2026-01-05T15:00:00.000Z',
}
const laptop: PasskeyListItem = {
  id: 2,
  label: 'Work laptop',
  addedAt: '2026-01-04T15:00:00.000Z',
  lastUsedAt: null,
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
  mocks.removePasskey.mockResolvedValue({ ok: true })
  mocks.signOut.mockResolvedValue(undefined)
})
afterEach(cleanup)

// The page puts the list inside the "Passkeys" card, a labelled section
const renderList = (passkeys: PasskeyListItem[]) =>
  render(
    <section aria-label="Passkeys">
      <PasskeyList passkeys={passkeys} />
    </section>,
  )

const removeButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^Remove passkey.*${label}`) })

describe('PasskeyList: the list', () => {
  it('lists each passkey with its name, when it was added and when it was last used', async () => {
    renderList([phone, laptop])
    const [first, second] = screen.getAllByRole('listitem')
    if (!first || !second) throw new Error('two rows expected')
    expect(within(first).getByText('My phone')).toBeTruthy()
    expect(within(first).getByText('Added')).toBeTruthy()
    expect(within(first).getByText('Last used')).toBeTruthy()
    expect(within(first).getAllByText(/Jan/)).toHaveLength(2)
    expect(within(second).getByText('Not used yet')).toBeTruthy()
    expect(within(second).getAllByRole('button', { name: /^Remove passkey/ })).toHaveLength(1)
    await expectAccessible(document.body)
  })

  it('says there are none, and keeps the lost-device advice, when the list is empty', async () => {
    renderList([])
    expect(screen.getByText('No passkeys yet.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText(/Lost a device\? Choose “Forgot your password\?”/)).toBeTruthy()
    await expectAccessible(document.body)
  })

  it('names the passkey in each button for a screen reader, starting with the visible words', () => {
    renderList([phone, laptop])
    expect(removeButton('My phone').textContent).toBe('Remove passkey')
    expect(removeButton('Work laptop').textContent).toBe('Remove passkey')
  })
})

describe('PasskeyList: confirming', () => {
  it('asks first, with the passkey’s name and what still works, moving focus into the dialog', async () => {
    renderList([phone, laptop])
    await userEvent.click(removeButton('My phone'))
    const dialog = await screen.findByRole('dialog', { name: 'Remove this passkey?' })
    expect(within(dialog).getByText('My phone')).toBeTruthy()
    expect(
      within(dialog).getByText(
        'You can still log in another way, or choose “Forgot your password?”.',
      ),
    ).toBeTruthy()
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(mocks.removePasskey).not.toHaveBeenCalled()
    await expectAccessible(document.body)
  })

  it('"Keep it" closes it, removes nothing and gives focus back to the button', async () => {
    renderList([phone, laptop])
    const button = removeButton('My phone')
    await userEvent.click(button)
    await userEvent.click(await screen.findByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.removePasskey).not.toHaveBeenCalled()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(document.activeElement).toBe(button)
  })

  it('Escape closes it the same way', async () => {
    renderList([phone])
    await userEvent.click(removeButton('My phone'))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.removePasskey).not.toHaveBeenCalled()
  })
})

describe('PasskeyList: removing', () => {
  const confirmRemove = async (label: string) => {
    await userEvent.click(removeButton(label))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove passkey' }))
  }

  it('sends only the passkey’s id, says so, drops the row and refreshes the page', async () => {
    renderList([phone, laptop])
    await confirmRemove('My phone')
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('Passkey removed.')
    expect(mocks.removePasskey).toHaveBeenCalledExactlyOnceWith({ passkeyId: 1 })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('My phone')).toBeNull()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    // Focus is on the message, not lost on the page body
    expect(document.activeElement).not.toBe(document.body)
    await expectAccessible(document.body)
  })

  it('shows the empty state after the last one goes', async () => {
    renderList([phone])
    await confirmRemove('My phone')
    await screen.findByText('Passkey removed.')
    expect(screen.getByText('No passkeys yet.')).toBeTruthy()
  })

  it('asks to log in again when the sign-in is too old, and keeps the passkey', async () => {
    mocks.removePasskey.mockResolvedValue({ ok: false, failure: 'sign-in-again' })
    renderList([phone])
    await confirmRemove('My phone')
    expect((await screen.findByRole('status')).textContent).toContain(
      'please log in again first. Then you can remove a passkey.',
    )
    expect(screen.getByText('My phone')).toBeTruthy()
    expect(mocks.refresh).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Log in again' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith('/login')
  })

  it('says it failed, in the one fixed message, and keeps the passkey', async () => {
    mocks.removePasskey.mockResolvedValue({ ok: false, failure: 'failed' })
    renderList([phone])
    await confirmRemove('My phone')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'We couldn’t remove that passkey. Please try again.',
    )
    expect(screen.getByText('My phone')).toBeTruthy()
    // It can be tried again
    expect(removeButton('My phone')).toBeTruthy()
  })

  it('says the connection failed when the request gets no answer', async () => {
    mocks.removePasskey.mockRejectedValue(new Error('network'))
    renderList([phone])
    await confirmRemove('My phone')
    expect((await screen.findByRole('alert')).textContent).toContain(FORM_MESSAGES.offline)
    expect(screen.getByText('My phone')).toBeTruthy()
  })

  it('does not pass on anything the server says as text', async () => {
    mocks.removePasskey.mockResolvedValue({ ok: false, failure: 'failed', message: 'SQL error' })
    renderList([phone])
    await confirmRemove('My phone')
    await screen.findByRole('alert')
    expect(document.body.textContent).not.toContain('SQL')
  })

  it('shows a long name without a space on its own line, wrapping inside its row', () => {
    const long = { ...phone, label: 'x'.repeat(60) }
    renderList([long])
    const name = screen.getByText('x'.repeat(60))
    expect(name.className).toContain('wrap-anywhere')
    expect(name.closest('li')?.className).toContain('flex-col')
  })
})
