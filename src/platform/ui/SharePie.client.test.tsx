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
    key: 'schools',
    name: 'Madison schools',
    amount: '$4,700',
    percent: 46,
    share: 46.5,
    tone: 'light',
  },
  {
    key: 'city',
    name: 'City of Madison',
    amount: '$3,467',
    percent: 38,
    share: 37.5,
    tone: 'highlight',
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
  it('is one named picture with a wedge for every slice, in order', () => {
    measuredAt(500)
    const { container } = render(<SharePie slices={SLICES} label="Your rough property tax" />)
    expect(screen.getByRole('img', { name: 'Your rough property tax' })).toBeTruthy()
    expect(wedges(container)).toEqual(['schools', 'city', 'county', 'matc'])
  })

  it('writes name, dollars and percent inside a wedge with room, and the percent alone in a thin one', () => {
    measuredAt(560)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    expect(inside(container, 'city')).toBe('City of Madison$3,46738%')
    expect(inside(container, 'matc')).toBe('3%')
  })

  it('lists in the legend what the pie cannot hold in full, and nothing else', () => {
    measuredAt(560)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    const entries = legend(container)
    expect(entries.some((e) => e?.includes('Madison College (MATC)'))).toBe(true)
    expect(entries.some((e) => e?.includes('Madison schools'))).toBe(false)
  })

  it('pulls the thin wedge’s percent out of a small pie into the legend', () => {
    measuredAt(300)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    expect(inside(container, 'matc')).toBeNull()
    const entry = legend(container).find((e) => e?.includes('Madison College (MATC)'))
    expect(entry).toContain('$350')
    expect(entry).toContain('3%')
  })

  it('keeps a row for every wedge on a small pie, hidden from everyone when the wedge is written inside', () => {
    measuredAt(380)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    const rows = Array.from(container.querySelectorAll('[data-pie-legend] li'))
    expect(rows).toHaveLength(SLICES.length)
    const hidden = rows.filter((row) => row.getAttribute('aria-hidden') === 'true')
    expect(hidden.length).toBeGreaterThan(0)
    expect(hidden.every((row) => row.className.includes('invisible'))).toBe(true)
    expect(hidden.length).toBe(
      SLICES.length - rows.filter((r) => !r.hasAttribute('aria-hidden')).length,
    )
  })

  it('keeps the legend’s room whether or not it has entries, so the card never changes height', () => {
    measuredAt(560)
    const roomy = render(
      <SharePie slices={SLICES.slice(0, 2).map((s) => ({ ...s, share: 50 }))} label="Pie" />,
    ).container
    expect(roomy.querySelector('[data-pie-legend]')).toBeTruthy()
    expect(legend(roomy)).toEqual([])
    const roomyClass = roomy.querySelector('[data-pie-legend]')?.className
    cleanup()
    const full = render(<SharePie slices={SLICES} label="Pie" />).container
    expect(full.querySelector('[data-pie-legend]')?.className).toBe(roomyClass)
  })

  it('draws a pie of one slice as a whole circle', () => {
    measuredAt(400)
    const { container } = render(
      <SharePie
        slices={[{ ...(SLICES[1] as SharePieSlice), share: 100, percent: 100 }]}
        label="Pie"
      />,
    )
    expect(wedges(container)).toEqual(['city'])
  })

  it('has no accessibility violations', async () => {
    measuredAt(400)
    const { container } = render(<SharePie slices={SLICES} label="Pie" />)
    await expectAccessible(container)
  })
})
