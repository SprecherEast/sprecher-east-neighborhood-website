// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SharePie, type SharePieSlice } from './SharePie.client'
import { expectAccessible } from './testing/expectAccessible'
import { measuredAt } from './testing/measuredAt'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SLICES: SharePieSlice[] = [
  {
    key: 'city',
    name: 'City of Madison',
    amount: '$3,467',
    percent: 38,
    share: 37.5,
    tone: 'highlight',
  },
  {
    key: 'schools',
    name: 'Madison schools',
    amount: '$4,700',
    percent: 46,
    share: 46.5,
    tone: 'light',
  },
  {
    key: 'county',
    name: 'Dane County',
    amount: '$1,300',
    percent: 13,
    share: 12.5,
    tone: 'medium',
  },
  {
    key: 'matc',
    name: 'Madison College (MATC)',
    amount: '$350',
    percent: 3,
    share: 3.5,
    tone: 'dark',
  },
]

const wedges = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('path[data-pie-slice]')).map((p) =>
    p.getAttribute('data-pie-slice'),
  )

/** What is written on one wedge, or null when nothing is */
const inside = (container: HTMLElement, key: string) =>
  container.querySelector(`text[data-pie-label="${key}"]`)?.textContent ?? null

const legend = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-pie-legend] li')).map((li) => li.textContent)

describe('SharePie', () => {
  it('is one named picture with a wedge for every slice', () => {
    measuredAt(500)
    const { container } = render(<SharePie slices={SLICES} label="Your rough property tax" />)
    expect(screen.getByRole('img', { name: 'Your rough property tax' })).toBeTruthy()
    expect(wedges(container).sort()).toEqual(['city', 'county', 'matc', 'schools'])
  })

  it('starts the first slice at the top of the pie and runs clockwise', () => {
    measuredAt(400)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    const city = container.querySelector('path[data-pie-slice="city"]')?.getAttribute('d') ?? ''
    // From the centre straight up to the rim: x stays at the centre, y goes to the rim
    expect(city).toMatch(/^M 200 200 L 200 2 /)
  })

  it('draws the highlighted slice last, so its outline shows on every edge', () => {
    measuredAt(400)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    const drawn = Array.from(container.querySelectorAll('path[data-pie-slice]')).map((p) =>
      p.getAttribute('data-pie-slice'),
    )
    expect(drawn.at(-1)).toBe('city')
  })

  it('writes only the percent inside a wedge with room, and nothing in a thin one on a small pie', () => {
    measuredAt(560)
    const wide = render(<SharePie slices={SLICES} label="Pie" />).container
    expect(inside(wide, 'city')).toBe('38%')
    expect(inside(wide, 'matc')).toBe('3%')
    cleanup()
    measuredAt(260)
    const small = render(<SharePie slices={SLICES} label="Pie" />).container
    expect(inside(small, 'schools')).toBe('46%')
    expect(inside(small, 'matc')).toBeNull()
  })

  it('lists every slice in the legend, in order, with its dollars and percent', () => {
    measuredAt(560)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    expect(legend(container)).toEqual([
      'City of Madison38%$3,467',
      'Madison schools46%$4,700',
      'Dane County13%$1,300',
      'Madison College (MATC)3%$350',
    ])
  })

  it('reads as a receipt: a heading above the rows and the total under them', () => {
    measuredAt(560)
    const { container } = render(
      <SharePie
        slices={SLICES}
        label="Pie"
        heading="For a home valued at $500,300"
        total={{ label: 'Total property tax', amount: '$9,296' }}
      />,
    )
    const receipt = container.querySelector('[data-pie-legend]')
    expect(receipt?.firstElementChild?.textContent).toBe('For a home valued at $500,300')
    // Big, bold and orange, so it is the first thing read under the pie
    expect(receipt?.firstElementChild?.className).toMatch(/text-lg.*font-bold.*text-accent-dark/)
    expect(receipt?.lastElementChild?.textContent).toBe('Total property tax$9,296')
  })

  it('lays the rows out as three columns, the name, the percent, then the amount, one grid for every row', () => {
    measuredAt(560)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    const list = container.querySelector('[data-pie-legend] ul')
    expect(list?.className).toContain('grid-cols-')
    const rows = Array.from(container.querySelectorAll('[data-pie-legend] li'))
    for (const row of rows) {
      expect(row.className).toContain('grid-cols-subgrid')
      expect(row.children).toHaveLength(3)
      // the amount never breaks across lines, and its right edge is the column's
      expect(row.children[2]?.className).toContain('text-right')
      expect(row.children[2]?.className).toContain('whitespace-nowrap')
      expect(row.children[1]?.className).toContain('text-right')
    }
  })

  it('writes the highlighted slice’s name in bold and no other', () => {
    measuredAt(560)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    const bold = Array.from(container.querySelectorAll('[data-pie-legend] li')).map((row) =>
      row.querySelector('[data-legend-name]')?.className.includes('font-bold'),
    )
    expect(bold).toEqual([true, false, false, false])
  })

  it('has the same legend row markup whatever the amounts, so the card never changes height', () => {
    measuredAt(560)
    const a = render(<SharePie slices={SLICES} label="Pie" />).container
    const classA = a.querySelector('[data-pie-legend] li')?.className
    cleanup()
    const b = render(
      <SharePie slices={SLICES.map((s) => ({ ...s, amount: '$1,234,567' }))} label="Pie" />,
    ).container
    expect(b.querySelector('[data-pie-legend] li')?.className).toBe(classA)
  })

  it('draws a pie of one slice as a whole circle', () => {
    measuredAt(400)
    const { container } = render(
      <SharePie
        slices={[{ ...(SLICES[0] as SharePieSlice), share: 100, percent: 100 }]}
        label="Pie"
      />,
    )
    expect(wedges(container)).toEqual(['city'])
  })

  it('has no accessibility violations', async () => {
    measuredAt(400)
    const { container } = render(
      <SharePie
        slices={SLICES}
        label="Pie"
        heading="For a home valued at $500,300"
        total={{ label: 'Total property tax', amount: '$9,296' }}
      />,
    )
    await expectAccessible(container)
  })
})
