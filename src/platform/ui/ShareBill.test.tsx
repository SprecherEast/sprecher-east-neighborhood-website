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
  it('reads like a receipt: the title on top with no amount, then the rows, and the total last (#1118, #1196)', () => {
    const { container } = render(
      <ShareBill slices={SLICES} label="Sample bill" title="Sample whole bill" total={TOTAL} />,
    )
    const title = screen.getByText('Sample whole bill')
    const list = screen.getByRole('list', { name: 'Sample bill' })
    const total = screen.getByText('Total').closest('p') as HTMLElement
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(title, list)).toBe(true)
    // No segmented bar on top: the only bars are the rows' own
    expect(container.querySelectorAll('svg')).toHaveLength(SLICES.length)
    expect(follows(list, total)).toBe(true)
    // No amount beside the title
    expect(title.textContent).toBe('Sample whole bill')
    // The total: label left, amount right, bold, under a stronger rule than the rows' lines
    expect(total.textContent).toBe('Total$10,000')
    // The rows and the total share one grid, so a column that widens moves both; the total's
    // amount ends at the dollar column's end, the last one, never under the percents (#1163, #1184)
    expect(total.parentElement).toBe(list.parentElement)
    expect(list.className).toContain('grid-cols-subgrid')
    expect(total.className).toContain('grid-cols-subgrid')
    const amount = total.lastElementChild as HTMLElement
    expect(amount.className).toContain('col-start-3')
    expect(amount.className).toContain('justify-self-end')
    // The rows' amounts end the same way
    expect(list.querySelector('li')?.children[2]?.className).toContain('justify-self-end')
    // The rows keep a side padding (px-1) the total's amount must keep too, to end where theirs end (#1184)
    expect(total.className).toContain('pr-1')
    expect(total.className).toContain('font-bold')
    expect(total.className).toContain('border-t-2')
  })

  it('keeps the receipt rows tight and level (#1118)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const row = container.querySelector('li') as HTMLElement
    expect(row.className).toContain('min-h-5')
    // A name never wraps: at the narrowest width it may run into its column's blank space instead
    expect(screen.getByText('Sample: first').className).toContain('truncate')
  })

  it('shows a short name on the narrowest phones, the full one where it fits and to screen readers (#1163)', () => {
    const slices = SLICES.map((slice, i) =>
      i === 3 ? { ...slice, name: 'Sample: fourth, long', shortName: 'Sample: fourth' } : slice,
    )
    const { container } = render(<ShareBill slices={slices} label="Sample bill" />)
    const row = container.querySelectorAll('li[data-share-row]')[3] as HTMLElement
    const name = row.children[0] as HTMLElement
    // The whole name is in the page; only its tail hides below 24 rem, kept for screen readers
    expect(name.textContent).toBe('Sample: fourth, long')
    const tail = name.querySelector('span') as HTMLElement
    expect(tail.textContent).toBe(', long')
    expect(tail.className).toContain('max-[24rem]:sr-only')
  })

  it('keeps a clear gap between the percent and the dollars at every width (#1163, #1184)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const grid = container.querySelector('ul')?.parentElement as HTMLElement
    expect(grid.className).toContain('gap-x-1.5')
    expect(grid.className).toContain('min-[24rem]:gap-x-2')
  })

  it('names every slice in the receipt with its percent and dollars, in the bar’s order', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const rows = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    // Like a bill, and like the breakdown chart: the name, the percent, then the dollars last (#1184)
    expect(rows).toEqual([
      'Sample: first38%$3,750',
      'Sample: second46%$4,650',
      'Sample: third13%$1,250',
      'Sample: fourth3%$350',
    ])
    const bars = Array.from(container.querySelectorAll('rect[data-share-bar]')).map((rect) =>
      rect.getAttribute('data-share-bar'),
    )
    expect(bars).toEqual(['a', 'b', 'c', 'd'])
  })

  it('builds every row the same way: no colour square, no fill, no border of its own (#1196)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const rows = Array.from(container.querySelectorAll('li'))
    expect(container.querySelector('li span[aria-hidden="true"]')).toBeNull()
    for (const row of rows) {
      expect(row.className).not.toContain('bg-primary')
      expect(row.className).not.toContain('font-semibold')
      expect(row.className).not.toContain('border')
    }
    // The first row differs only in the space above it, so every row is as tall as the others
    const shape = (row: Element) => row.className.replace(/first:\S+|pt-\d+/g, '').trim()
    expect(new Set(rows.map(shape)).size).toBe(1)
  })

  it('draws each slice’s bar on one scale: the largest slice fills the track, the others are in proportion (#1196)', () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    const width = (key: string) =>
      Number(
        container
          .querySelector(`rect[data-share-bar="${key}"]`)
          ?.getAttribute('width')
          ?.slice(0, -1),
      )
    expect(width('b')).toBe(100)
    expect(width('a')).toBeCloseTo((37.5 / 46.5) * 100, 1)
    expect(width('c')).toBeCloseTo((12.5 / 46.5) * 100, 1)
    expect(width('d')).toBeCloseTo((3.5 / 46.5) * 100, 1)
    // Each bar is drawn in its own slice's tone
    expect(container.querySelector('rect[data-share-bar="a"]')?.getAttribute('class')).toContain(
      'fill-primary-fill',
    )
  })

  it('flashes the total only once a pulse has been asked for', () => {
    const { rerender } = render(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} />)
    const flashes = () => screen.getByText('Total').closest('p')?.className.includes('total-pulse')
    expect(flashes()).toBe(false)
    rerender(<ShareBill slices={SLICES} label="Sample bill" total={TOTAL} pulseKey={1} />)
    expect(flashes()).toBe(true)
  })

  it('nests extra content under one slice’s row, indented and marked by a line, as one row of its own (#1163, #1196)', () => {
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
    // It spans the three columns, indented, with a line down its side
    expect(nested.className).toContain('col-span-3')
    expect(nested.className).toContain('ml-1')
    expect(nested.className).toContain('border-l-2')
    // Its button keeps the full width on the right: only its amounts are set in, by `NESTED_AMOUNTS_INSET` (#1196)
    // It ends where the bars end (the rows' `px-1`)
    expect(nested.className).toContain('pr-1')
    expect(nested.className).not.toContain('mr-')
    expect(rows[2]?.textContent).toBe('Sample: second46%$4,650')
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

  it('gives its title an id when asked, for a row inside it to keep in view (#1178)', () => {
    const { getByText } = render(
      <ShareBill
        slices={SLICES}
        label="Sample bill"
        title="Sample whole bill"
        titleId="bill-title"
      />,
    )
    expect(getByText('Sample whole bill').id).toBe('bill-title')
  })

  it('draws no title or total line without them, and has no accessibility violations', async () => {
    const { container } = render(<ShareBill slices={SLICES} label="Sample bill" />)
    expect(container.querySelector('p')).toBeNull()
    await expectAccessible(container)
  })
})
