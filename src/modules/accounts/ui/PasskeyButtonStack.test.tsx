// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PasskeyButtonRoom } from './PasskeyButtonRoom'
import { PasskeyButtonStack } from './PasskeyButtonStack'

afterEach(cleanup)

describe('PasskeyButtonStack', () => {
  it('stacks its children in a flex column with a gap', () => {
    render(
      <PasskeyButtonStack>
        <p>first</p>
        <p>second</p>
      </PasskeyButtonStack>,
    )
    const stack = screen.getByText('first').parentElement
    expect(stack?.className).toBe('flex flex-col gap-3')
  })

  it('wraps the held room the same way as it wraps the real button', () => {
    const { container } = render(<PasskeyButtonRoom />)
    const room = container.firstElementChild
    const real = render(<PasskeyButtonStack>{null}</PasskeyButtonStack>).container.firstElementChild
    expect(room?.className).toBe(real?.className)
  })

  it('holds a room as tall as the real button: both are the kit’s `lg` size (#1375)', () => {
    const { container } = render(<PasskeyButtonRoom />)
    expect(container.querySelector('button')?.className).toMatch(/min-h-12/)
  })
})
