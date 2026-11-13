// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ShareBill, TOTAL_PULSE_MS, type ShareSlice } from './ShareBill'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const SLICES: ShareSlice[] = [
  {
    key: 'a',
    name: 'Sample: first',
    amount: '$3,750',
    percent: 38,
    share: 37.5,
    tone: 'highlight',
  },
  { key: 'b', name: 'Sample: second', amount: '$4,650', percent: 46, share: 46.5, tone: 'light' },
  { key: 'c', name: 'Sample: third', amount: '$1,250', percent: 13, share: 12.5, tone: 'medium' },
  { key: 'd', name: 'Sample: fourth', amount: '$350', percent: 3, share: 3.5, tone: 'strong' },
]
const TOTAL = { label: 'Total', amount: '$10,000' }

describe('ShareBill', () => {
  it('reads like a receipt: the title on top with no amount, then the bar, the rows, and the total last (#1118)', () => {
    const { container } = render(
      <ShareBill slices={SLICES} label="Sample bill" title="Sample whole bill" total={TOTAL} />,
    )
    const title = screen.getByText('Sample whole bill')
    const bar = screen.getByRole('img', { name: 'Sample bill' })
    const list = container.querySelector('ul') as HTMLElement
    const total = screen.getByText('Total').closest('p') as HTMLElement
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(title, bar)).toBe(true)
    expect(follows(bar, list)).toBe(true)
    expect(follows(list, total)).toBe(true)
    // No amount beside the title
    expect(title.textContent).toBe('Sample whole bill')
    // The total: label left, amount right, bold, under a stronger rule than the rows' lines
    expect(total.textContent).toBe('Total$10,000')
    // The total's amount sits in the rows' dollar column, with the percent column left empty (#1163)
    const columns = (el: Element) => /\S*grid-cols-\[[^\]]+\]/g.exec(el.className)?.[0]
    expect(columns(total)).toBe(columns(list))
    expect(total.lastElementChild?.className).toContain('col-start-2')
    expect(total.className).toContain('font-bold')
    expect(total.className).toContain('border-t-2')
  })

  it('keeps the receipt rows tight and level (#1118)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const row = container.querySelector('li') as HTMLElement
    expect(row.className).toContain('min-h-5')
    // A name never wraps: at the narrowest width it may run into its column's blank space instead
    expect(screen.getByText('Sample: first').className).toContain('whitespace-nowrap')
  })

  it('keeps a clear gap between the dollars and the percent at every width (#1163)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const list = container.querySelector('ul') as HTMLElement
    expect(list.className).toContain('gap-x-2')
    expect(list.className).toContain('min-[24rem]:gap-x-3')
  })

  it('names every slice in the receipt with its percent and dollars, in the bar’s order', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const rows = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    // Like the breakdown chart: the dollars, then the percent (#1163)
    expect(rows).toEqual([
      'Sample: first$3,75038%',
      'Sample: second$4,65046%',
      'Sample: third$1,25013%',
      'Sample: fourth$3503%',
    ])
    const bar = Array.from(container.querySelectorAll('rect[data-share-slice]')).map((rect) =>
      rect.getAttribute('data-share-slice'),
    )
    expect(bar).toEqual(['a', 'b', 'c', 'd'])
  })

  it('highlights the highlighted slice’s row with a soft primary fill and bolder text, and no other (#1121)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const rows = Array.from(container.querySelectorAll('li'))
    expect(rows[0]?.className).toContain('bg-primary/10')
    expect(rows[0]?.className).toContain('font-semibold')
    for (const row of rows.slice(1)) {
      expect(row.className).not.toContain('bg-primary')
      expect(row.className).not.toContain('font-semibold')
    }
    // Every row has the same side padding, so the columns stay level
    expect(new Set(rows.map((row) => /px-\S+/.exec(row.className)?.[0])).size).toBe(1)
  })

  it('writes every slice’s percent on the bar, the smallest too (#1121)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const written = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent)
    expect(written).toEqual(['38%', '46%', '13%', '3%'])
  })

  it('flashes the total only once a pulse has been asked for', () => {
    const { rerender } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const flashes = () => screen.getByText('Total').closest('p')?.className.includes('total-pulse')
    expect(flashes()).toBe(false)
    rerender(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} pulseKey={1} />)
    expect(flashes()).toBe(true)
  })

  it('nests extra content under one slice’s row, indented to the slice’s name, as one row of its own (#1163)', () => {
    const { container } = render(
      <ShareBill
        slices={SLICES}
        label="Sample bill"
        nested={{ after: 'a', children: <p>More on the first</p> }}
      />,
    )
    const rows = Array.from(container.querySelectorAll('ul > li'))
    expect(rows).toHaveLength(SLICES.length + 1)
    const nested = rows[1] as HTMLElement
    expect(nested.textContent).toBe('More on the first')
    // It spans the three columns and starts where the names start, past the colour square
    expect(nested.className).toContain('col-span-3')
    expect(nested.className).toContain('pl-4')
    expect(nested.className).toContain('min-[24rem]:pl-6')
    expect(rows[2]?.textContent).toBe('Sample: second$4,65046%')
    // Only the slices' own rows carry their key, so a list inside the nested content is never one
    expect(container.querySelectorAll('li[data-share-row]')).toHaveLength(SLICES.length)
    expect(nested.hasAttribute('data-share-row')).toBe(false)
  })

  it('nests nothing when the slice named is not in the bill (#1163)', () => {
    const { container } = render(
      <ShareBill slices={SLICES} label="Sample bill" nested={{ after: 'z', children: 'More' }} />,
    )
    expect(container.querySelectorAll('ul > li')).toHaveLength(SLICES.length)
  })

  it('flashes for exactly the shared length callers wait out, the one the theme’s animation uses (#1163)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
    const length = /animation:\s*total-pulse\s+([\d.]+)s/.exec(css)?.[1]
    expect(Number(length) * 1000).toBe(TOTAL_PULSE_MS)
  })

  it('draws no title or total line without them, and has no accessibility violations', async () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    expect(container.querySelector('p')).toBeNull()
    await expectAccessible(container)
  })
})
