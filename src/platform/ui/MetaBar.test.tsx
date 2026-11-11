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

  it('draws one straight groove directly under the metadata, hidden from assistive technology', () => {
    const { container } = render(<MetaBar items={items} />)

    const decorative = container.querySelectorAll('[aria-hidden="true"]')
    expect(decorative).toHaveLength(1)
    const line = decorative[0]
    expect(line?.textContent).toBe('')
    // The line follows the metadata and spans the whole column: a block, not a shaped piece
    expect(line?.previousElementSibling?.querySelector('dl')).not.toBeNull()
    expect(line?.className).not.toMatch(/(^|\s)(w-|absolute|before:|after:)/)
    // Everything a reader needs is real text outside it
    expect(container.querySelector('dl')?.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('makes the groove two hairlines from theme tokens: a dark one, then the accent', () => {
    const { container } = render(<MetaBar items={items} />)

    const line = container.querySelector('[aria-hidden="true"]')
    expect(line?.className).toContain('border-t')
    expect(line?.className).toContain('border-input')
    expect(line?.className).toContain('var(--color-accent)')
    expect(line?.className).not.toContain('rounded')
  })

  it('has no box, tab or shape around the metadata: the line is its only frame', () => {
    const { container } = render(<MetaBar items={items} />)

    for (const element of container.querySelectorAll('div:not([aria-hidden]), dl')) {
      const names = element.className.split(' ')
      expect(names.filter((name) => /^(bg-|border|rounded|shadow|ring)/.test(name))).toEqual([])
    }
    expect(container.querySelector('[class*="before:"], [class*="after:"]')).toBeNull()
  })

  it('aligns the metadata to the left edge of the column, above the line', () => {
    render(<MetaBar items={items} />)

    const wrapper = screen.getByText('Author').closest('dl')?.parentElement
    expect(wrapper?.className).not.toMatch(/justify-end|text-right|text-center|ml-auto/)
    expect(screen.getByText('Author').className).not.toMatch(/text-right|text-center/)
  })

  it('sets its items in one row from md, on one text baseline, with a hairline between them', () => {
    render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    expect(list?.className).toContain('md:flex')
    // Items align on their text baseline, so a link or icon in one never lowers its neighbour
    expect(list?.className).toContain('items-baseline')
    const [first, second] = Array.from(list?.children ?? [])
    expect(first?.className).not.toContain('border-l')
    expect(second?.className).toContain('md:border-l')
    // The last item ends on the column's edge: no padding after it
    expect(second?.className).not.toContain('md:pr-3')
  })

  it('becomes a two-column list below md: labels in one column, values in the other', () => {
    render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    expect(list?.className).toContain('grid')
    expect(list?.className).toContain('grid-cols-[max-content_minmax(0,1fr)]')
    // Each item's label and value are the grid's own cells
    expect(list?.firstElementChild?.className).toContain('contents')
    // Both labels share the column's left edge, and a wrapped value starts at the value column
    expect(screen.getByText('Author').className).not.toContain('text-right')
  })

  it('keeps the value column right after the label column, even with a single short item', () => {
    render(<MetaBar items={[{ label: 'Published', value: 'Tue, Nov 10, 2026' }]} />)

    // The label column is as wide as its labels and the value column takes the rest, so no free
    // width is left to push a short value to the far edge of the row
    const list = screen.getByText('Published').closest('dl')
    expect(list?.className).toContain('grid-cols-[max-content_minmax(0,1fr)]')
    expect(list?.className).toContain('gap-x-2')
  })

  it('sets its labels in the theme’s finest text size, a token, smaller than the values', () => {
    render(<MetaBar items={items} />)

    const label = screen.getByText('Author')
    expect(label.className).toContain('text-fine')
    expect(label.className).not.toMatch(/text-\[/)
    expect(screen.getByText('Ana and Ben').closest('dd')?.className).toContain('text-xs')
  })

  describe('a value that is too long for one line', () => {
    const long = 'A very long venue name '.repeat(12).trim()

    it('is cut to one line with an ellipsis, its whole text in the title and in the page', async () => {
      const { container } = render(
        <MetaBar
          items={[
            { label: 'Where', value: long, title: long },
            { label: 'When', value: 'Sat, Nov 7' },
          ]}
        />,
      )

      const cut = screen.getByTitle(long)
      expect(cut.className).toContain('truncate')
      expect(cut.className).toContain('min-w-0')
      // Cut by style only: assistive technology still reads all of it
      expect(cut.textContent).toBe(long)
      await expectAccessible(container)
    })

    it('gives up width before the other items, which stay whole while the row can hold them', () => {
      render(
        <MetaBar
          items={[
            { label: 'When', value: 'Sat, Nov 7' },
            { label: 'Where', value: long, title: long },
          ]}
        />,
      )

      expect(screen.getByText('When').parentElement?.className).toContain('md:shrink-0')
      expect(screen.getByText('Where').parentElement?.className).not.toContain('shrink-0')
    })

    it('is capped at 20rem, so the items stay grouped at the left instead of spreading across the row', () => {
      render(<MetaBar items={[{ label: 'Where', value: long, title: long }]} />)

      expect(screen.getByTitle(long).className).toContain('md:max-w-80')
    })

    it('lets items shrink as usual when no value is cut', () => {
      render(<MetaBar items={items} />)

      expect(screen.getByText('Author').parentElement?.className).not.toContain('shrink-0')
    })

    it('keeps a suffix whole beside the cut value', () => {
      render(
        <MetaBar items={[{ label: 'Where', value: long, title: long, suffix: ' · Hybrid' }]} />,
      )

      const suffix = screen.getByText('· Hybrid')
      expect(suffix.className).toContain('shrink-0')
      expect(suffix.previousElementSibling?.className).toContain('truncate')
    })

    it('wraps inside its item when it has no title to cut to', () => {
      render(<MetaBar items={[{ label: 'Author', value: long }, ...items.slice(1)]} />)

      const value = screen.getByText('Author').nextElementSibling
      expect(value?.className).toContain('min-w-0')
      expect(value?.className).toContain('break-words')
    })
  })

  it('keeps the classes it is given, for the width the page sets', () => {
    const { container } = render(<MetaBar items={items} className="max-w-[40rem]" />)

    expect(container.firstElementChild?.className).toContain('max-w-[40rem]')
  })
})

describe('MetaBar aligned to the end (#1055)', () => {
  const longName = 'Bartholomew Featherstonehaugh-Kowalczyk and Dorothea Wainwright-Papadopoulos'
  const post = [
    { label: 'Author', value: longName, title: longName },
    { label: 'Published', value: 'Nov 3' },
  ]

  it('sets one row at every width, ending on the column’s right edge, above the same groove', () => {
    const { container } = render(<MetaBar items={post} align="end" />)

    const list = container.querySelector('dl')
    expect(list?.className).toContain('flex')
    expect(list?.className).toContain('justify-end')
    expect(list?.className).not.toMatch(/(^|\s)(grid|flex-col)(\s|$)/)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('border-input')
  })

  it('sets the values in the theme’s finest text size, like the labels', () => {
    render(<MetaBar items={post} align="end" />)

    expect(screen.getByText('Nov 3').closest('dd')?.className).toContain('text-fine')
    expect(screen.getByText('Author').className).toContain('text-fine')
  })

  it('cuts a long value to one line with an ellipsis at every width, its whole text in the title', () => {
    render(<MetaBar items={post} align="end" />)

    const cut = screen.getByTitle(longName)
    expect(cut.className).toContain('truncate')
    expect(cut.className).not.toContain('md:max-w')
    expect(cut.textContent).toBe(longName)
    // The date keeps its width: the name gives up room first
    expect(screen.getByText('Published').parentElement?.className).toContain('shrink-0')
    expect(screen.getByText('Author').parentElement?.className).not.toContain('shrink-0')
  })

  it('keeps a hairline between the items and none after the last', () => {
    render(<MetaBar items={post} align="end" />)

    const [first, second] = Array.from(screen.getByText('Author').closest('dl')?.children ?? [])
    expect(first?.className).not.toContain('border-l')
    expect(second?.className).toContain('border-l')
    expect(second?.className).not.toContain('pr-3')
  })

  it('leaves the start alignment as it was', () => {
    const { container } = render(<MetaBar items={items} />)

    expect(container.querySelector('dl')?.className).toContain('grid')
    expect(container.querySelector('dl')?.className).not.toContain('justify-end')
  })
})
