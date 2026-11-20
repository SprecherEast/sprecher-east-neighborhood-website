// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

// The list and the add form have their own tests: this checks how the card puts them together
vi.mock('./PasskeyList.client', () => ({
  PasskeyList: ({ passkeys }: { passkeys: unknown[] }) => <p>{passkeys.length} passkeys</p>,
}))
vi.mock('./AddPasskeyLoader.client', () => ({ AddPasskey: () => <form aria-label="Add" /> }))

import { PasskeysCard } from './PasskeysCard'

afterEach(cleanup)

describe('PasskeysCard', () => {
  it('is one labelled card: the list first, then the add form', async () => {
    render(
      <PasskeysCard
        passkeys={[
          { id: 1, label: 'My phone', addedAt: '2026-01-03T00:00:00.000Z', lastUsedAt: null },
        ]}
      />,
    )
    const card = screen.getByRole('region', { name: 'Passkeys' })
    expect(card.textContent).toContain('1 passkeys')
    const list = screen.getByText('1 passkeys')
    const add = screen.getByRole('form', { name: 'Add' })
    expect(list.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expectAccessible(document.body)
  })
})
