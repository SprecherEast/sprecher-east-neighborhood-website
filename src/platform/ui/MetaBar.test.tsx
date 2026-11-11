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

  it('aligns the metadata to the right edge of the column, above the line (#1055)', () => {
    render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    // Phone: the items stack, each one ending on the right edge; from md: one row ending there
    expect(list?.className).toContain('items-end')
    expect(list?.className).toContain('md:justify-end')
    for (const item of Array.from(list?.children ?? [])) {
      expect(item.className).toContain('justify-end')
    }
    expect(screen.getByText('Ana and Ben').closest('dd')?.className).toContain('text-right')
    expect(list?.className).not.toMatch(/text-left|justify-start/)
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

  it('stacks below md: one line per item, label then value, both ending on the right edge', () => {
    render(<MetaBar items={items} />)

    const list = screen.getByText('Author').closest('dl')
    expect(list?.className).toContain('flex-col')
    expect(list?.className).not.toContain('grid')
    // The label sits right before its value inside the item, so a short value never drifts away
    const item = screen.getByText('Author').parentElement
    expect(item?.className).toContain('flex')
    expect(item?.className).not.toContain('contents')
    expect(screen.getByText('Author').nextElementSibling?.textContent).toBe('Ana and Ben')
  })

  it('keeps a short value whole beside long ones: from md no item shrinks below 11rem (#1055)', () => {
    render(<MetaBar items={items} />)

    for (const item of Array.from(screen.getByText('Author').closest('dl')?.children ?? [])) {
      expect(item.className).toContain('md:min-w-44')
    }
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

    it('is capped at 20rem, so the items stay grouped at the right instead of spreading across the row', () => {
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
