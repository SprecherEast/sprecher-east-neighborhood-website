// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Field } from './Field.client'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

function Box({ start = '' }: { start?: string }) {
  const [value, setValue] = useState(start)
  return (
    <Field label="Home value">
      <Field.Money value={value} onValueChange={setValue} />
    </Field>
  )
}

const box = () => screen.getByRole('textbox', { name: 'Home value' }) as HTMLInputElement

describe('Field.Money', () => {
  it('groups the digits with commas as they are typed, keeping the dollar sign', async () => {
    render(<Box />)
    await userEvent.type(box(), '500300')
    expect(box().value).toBe('$500,300')
  })

  it('offers the number pad on a phone', () => {
    render(<Box />)
    expect(box().getAttribute('inputmode')).toBe('numeric')
  })

  it('ignores letters and keeps only the dollars of a pasted value with cents', () => {
    render(<Box />)
    fireEvent.change(box(), { target: { value: 'ab$1,250,000.99' } })
    expect(box().value).toBe('$1,250,000')
  })

  it('empties when the last digit is deleted', async () => {
    render(<Box start="$5" />)
    await userEvent.type(box(), '{backspace}')
    expect(box().value).toBe('')
  })

  it('keeps the caret in place when a digit is typed in the middle', () => {
    render(<Box start="$1,200" />)
    const input = box()
    input.focus()
    // the reader puts a 5 after the 2: "$1,25|00" before it is regrouped
    fireEvent.change(input, { target: { value: '$1,2500', selectionStart: 5, selectionEnd: 5 } })
    expect(input.value).toBe('$12,500')
    expect(input.selectionStart).toBe(5)
  })

  it('keeps the caret where it was when a typed letter is refused in the middle', async () => {
    render(<Box start="$12,500" />)
    const input = box()
    input.focus()
    fireEvent.change(input, { target: { value: '$12,a500', selectionStart: 5, selectionEnd: 5 } })
    await Promise.resolve()
    expect(input.value).toBe('$12,500')
    // after the second digit, as before the letter was typed
    expect(input.selectionStart).toBe(3)
  })

  it('moves the caret left over a comma that Backspace removed, rather than to the end', async () => {
    render(<Box start="$12,500" />)
    const input = box()
    input.focus()
    // Backspace with the caret right after the comma: "$12,|500" becomes "$12|500"
    fireEvent.change(input, { target: { value: '$12500', selectionStart: 3, selectionEnd: 3 } })
    await Promise.resolve()
    expect(input.value).toBe('$12,500')
    expect(input.selectionStart).toBe(3)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Box start="$500,300" />)
    await expectAccessible(container)
  })
})
