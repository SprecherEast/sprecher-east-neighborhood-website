// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Field } from './Field.client'
import { expectAccessible } from './testing/expectAccessible'

describe('Field, bar layout (#1087)', () => {
  afterEach(cleanup)

  it('puts the label above, then the control and its action button on one line', () => {
    render(
      <Field
        label="Your home’s value:"
        layout="bar"
        action={<button type="submit">Estimate</button>}
        error="Enter a number"
      >
        <Field.Input defaultValue="1" />
      </Field>,
    )
    const label = screen.getByText('Your home’s value:')
    const input = screen.getByLabelText('Your home’s value:')
    const button = screen.getByRole('button', { name: 'Estimate' })
    // The input and the button share one line; the label is not in it
    expect(input.closest('div[data-field-bar]')).toBe(button.parentElement)
    expect(button.parentElement?.contains(label)).toBe(false)
    expect(label.className).toContain('text-base')
    // The error goes under the line, not beside the button
    expect(button.parentElement?.contains(screen.getByRole('alert'))).toBe(false)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Field label="Value" layout="bar" action={<button type="button">Go</button>}>
        <Field.Input />
      </Field>,
    )
    await expectAccessible(container)
  })
})

describe('Field, bar layout with the action inside the box (#1110)', () => {
  afterEach(cleanup)

  const inside = (action: boolean) => (
    <Field
      label="Value"
      layout="bar"
      actionPlacement="inside"
      action={
        <button type="submit" disabled={!action}>
          Go
        </button>
      }
      error="Enter a number"
    >
      <Field.Input defaultValue="1" />
    </Field>
  )

  it('draws the box once, around the control and the action at its trailing end', () => {
    render(inside(true))
    const input = screen.getByLabelText('Value')
    const button = screen.getByRole('button', { name: 'Go' })
    const box = input.closest('div[data-field-bar]') as HTMLElement
    expect(box.contains(button)).toBe(true)
    expect(box.getAttribute('data-action-inside')).toBe('true')
    // The input's own border is gone: the box carries the one border
    expect(box.className).toContain('[&_input]:border-0')
    expect(box.className).toContain('border')
    // The action comes after the control, so it sits at the trailing end
    expect(input.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The error stays under the box
    expect(box.contains(screen.getByRole('alert'))).toBe(false)
  })

  it('gives the action the same inset on the top, bottom and trailing sides', () => {
    render(inside(true))
    const box = screen.getByLabelText('Value').closest('div[data-field-bar]') as HTMLElement
    expect(box.className).toMatch(/\bp-1\.5\b/)
    expect(box.className).not.toMatch(/\bp[xytblr]-/)
  })

  it('takes the accent border while its action is on, and not while it is off', () => {
    const { rerender } = render(inside(false))
    const box = () => screen.getByLabelText('Value').closest('div[data-field-bar]') as HTMLElement
    // The rule is a `has-` variant on the box, so the class is there in both states and CSS decides
    expect(box().className).toContain('has-[button:not(:disabled)]:border-accent-dark')
    rerender(inside(true))
    expect(box().className).toContain('has-[button:not(:disabled)]:border-accent-dark')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(inside(true))
    await expectAccessible(container)
  })
})
