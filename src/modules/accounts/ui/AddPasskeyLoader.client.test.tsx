// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./AddPasskey.client', () => ({ AddPasskey: () => <section aria-label="Passkeys" /> }))

import { AddPasskey } from './AddPasskeyLoader.client'

afterEach(cleanup)

describe('AddPasskey loader', () => {
  it('shows the card once its code has loaded', async () => {
    render(<AddPasskey />)
    expect(await screen.findByRole('region', { name: 'Passkeys' })).toBeTruthy()
  })
})
