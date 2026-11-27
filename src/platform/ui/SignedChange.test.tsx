// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { SignedChange } from './SignedChange'

afterEach(cleanup)

describe('SignedChange', () => {
  it('writes the sign into the text and the percent in brackets', () => {
    const { container } = render(<SignedChange direction="down" amount="−$3.4M" percent="−2.9%" />)
    expect(container.textContent).toContain('−$3.4M (−2.9%)')
    expect(
      container.querySelector('[data-signed-change]')?.getAttribute('data-signed-change'),
    ).toBe('down')
  })

  it('says the direction aloud, whatever the colour', () => {
    render(<SignedChange direction="up" amount="+$1.0M" percent={null} />)
    expect(screen.getByText(/^Up:/).className).toContain('sr-only')
  })

  it('draws no colour of its own: it follows the text it sits in', () => {
    const { container } = render(<SignedChange direction="up" amount="+$1.0M" percent="+1.0%" />)
    expect(container.innerHTML).not.toMatch(/text-(red|green|destructive|success)/)
  })

  it('passes axe', async () => {
    const { container } = render(<SignedChange direction="same" amount="$0" percent="0%" />)
    await expectAccessible(container)
  })
})
