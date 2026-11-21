// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./PasskeyOffer.client', () => ({
  PasskeyOffer: ({ eligible }: { eligible: boolean }) => (
    <section aria-label="Offer" data-eligible={String(eligible)} />
  ),
}))

import { PasskeyOffer } from './PasskeyOfferLoader.client'

afterEach(cleanup)

describe('PasskeyOffer loader', () => {
  it('shows the offer once its code has loaded, and passes on who it is for', async () => {
    render(<PasskeyOffer eligible />)
    expect(
      (await screen.findByRole('region', { name: 'Offer' })).getAttribute('data-eligible'),
    ).toBe('true')
  })
})
