// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { SignInMethods } from './SignInMethods'

afterEach(cleanup)

describe('SignInMethods', () => {
  it('lists the ways in in the order given, then one divider in the site’s words (#1365)', async () => {
    const { container } = render(
      <main>
        <SignInMethods>
          <button type="button">First way</button>
          <button type="button">Second way</button>
        </SignInMethods>
      </main>,
    )
    const [first, second] = screen.getAllByRole('button')
    const divider = screen.getByText('Or use your email and password')

    expect(first?.textContent).toBe('First way')
    expect(second?.textContent).toBe('Second way')
    expect(second?.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expectAccessible(container)
  })

  it('marks the group to hide itself, divider included, while the list is empty', () => {
    const { container } = render(<SignInMethods>{null}</SignInMethods>)

    expect(container.querySelector('[data-sign-in-methods]')?.childElementCount).toBe(0)
    expect(container.firstElementChild?.className).toContain(
      'has-[>[data-sign-in-methods]:empty]:hidden',
    )
  })
})
