// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MetaBar } from './MetaBar'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const items = [
  { label: 'Author', value: 'Ana and Ben' },
  { label: 'Published', value: 'Tue, Nov 3, 2026' },
]

describe('MetaBar (#1002)', () => {
  it('is a description list: each label names the value beside it', async () => {
    const { container } = render(<MetaBar items={items} />)

    expect(screen.getByText('Author').tagName).toBe('DT')
    expect(screen.getByText('Author').nextElementSibling?.textContent).toBe('Ana and Ben')
    expect(screen.getByText('Published').nextElementSibling?.textContent).toBe('Tue, Nov 3, 2026')
    expect(container.querySelectorAll('dt')).toHaveLength(2)
    await expectAccessible(container)
  })

  it('draws nothing, and leaves no gap, without items', () => {
    const { container } = render(<MetaBar items={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('draws its line as pieces hidden from assistive technology, with no text of their own', () => {
    const { container } = render(<MetaBar items={items} />)

    const decorative = container.querySelectorAll('[aria-hidden="true"]')
    expect(decorative).toHaveLength(2)
    for (const piece of decorative) expect(piece.textContent).toBe('')
    // Everything a reader needs is real text outside them
    expect(container.querySelector('dl')?.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('has no box of its own: the line is its only frame', () => {
    render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    expect(
      list?.className.split(' ').filter((name) => /^(bg-|border|rounded|shadow|ring)/.test(name)),
    ).toEqual([])
  })

  it('draws a square tab over the metadata with two hairlines: a dark one, then the accent', () => {
    const { container } = render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    expect(list?.className).toContain('before:border-input')
    expect(list?.className).toContain('var(--color-accent)')
    expect(list?.className).not.toContain('rounded')
    for (const line of container.querySelectorAll('[aria-hidden="true"]')) {
      expect(line.className).toContain('border-input')
      expect(line.className).toContain('var(--color-accent)')
    }
  })

  it('stacks its items right-aligned below sm, and sets them in a row from sm with a hairline between', () => {
    render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    expect(list?.className).toContain('max-sm:flex-col')
    expect(list?.className).toContain('max-sm:items-end')
    expect(list?.className).toContain('sm:flex-row')
    const [first, second] = Array.from(list?.children ?? [])
    expect(first?.className).not.toContain('border-l')
    expect(second?.className).toContain('sm:border-l')
  })

  it('lets a long value wrap inside its item instead of widening the bar', () => {
    const long = 'A very long venue name '.repeat(12)
    render(
      <MetaBar
        items={[
          { label: 'Where', value: long },
          { label: 'When', value: 'Sat, Nov 7' },
        ]}
      />,
    )

    const value = screen.getByText('Where').nextElementSibling
    expect(value?.className).toContain('min-w-0')
    expect(value?.className).toContain('break-words')
  })

  it('keeps the classes it is given, for the width the page sets', () => {
    const { container } = render(<MetaBar items={items} className="max-w-[40rem]" />)

    expect(container.firstElementChild?.className).toContain('max-w-[40rem]')
  })
})
