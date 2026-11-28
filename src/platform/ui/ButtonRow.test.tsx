// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './Button'
import { ButtonRow } from './ButtonRow'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('ButtonRow', () => {
  it('holds its buttons in order, stacked on a phone and in a row from the wider layout up', async () => {
    const { container } = render(
      <ButtonRow>
        <Button>Allow</Button>
        <Button variant="secondary">Don’t allow</Button>
      </ButtonRow>,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Allow', 'Don’t allow'])
    const row = buttons[0]?.parentElement
    expect(row?.className).toContain('flex-col')
    expect(row?.className).toContain('sm:flex-row')
    expect(row?.className).not.toContain('justify-end')
    await expectAccessible(container)
  })

  it('puts the buttons at the right from the wider layout up when asked', () => {
    render(
      <ButtonRow align="end">
        <Button>Remove</Button>
      </ButtonRow>,
    )
    expect(screen.getByRole('button').parentElement?.className).toContain('sm:justify-end')
  })
})
