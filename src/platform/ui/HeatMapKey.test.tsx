// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HeatMap, type HeatMapProps } from './HeatMap'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

// Mon 2026-11-09 to Sun 2026-11-15
const week = [
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-15',
]
const cells = (c: HTMLElement) => [...c.querySelectorAll('[data-heat-cell]')] as HTMLElement[]

describe('HeatMap caption and key', () => {
  const props: HeatMapProps = {
    variant: 'calendar',
    days: week,
    values: [0, 1, 2, 3, 4, 5, 6],
    label: 'Finished each day: 0, 1, 2, 3, 4, 5, 6',
  }

  it('puts the caption and a Less-to-More key under the squares', () => {
    const { container } = render(<HeatMap {...props} caption="Work done per day" />)
    const caption = screen.getByText('Work done per day')
    const rows = container.querySelectorAll('[data-heat-row]')
    expect(rows[rows.length - 1].compareDocumentPosition(caption)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(screen.getByText('Less')).toBeTruthy()
    expect(screen.getByText('More')).toBeTruthy()
  })

  it('draws one swatch per shade step, the same classes the squares use', () => {
    const { container } = render(<HeatMap {...props} caption="Work done per day" />)
    const swatches = [...container.querySelectorAll('[data-heat-key-swatch]')]
    expect(swatches).toHaveLength(5)
    const squares = new Set(cells(container).map((c) => c.className.match(/bg-done[^ ]*/)?.[0]))
    for (const swatch of swatches)
      expect(squares.has(swatch.className.match(/bg-done[^ ]*/)?.[0])).toBe(true)
  })

  it('puts the caption left and the key right, and moves the whole key under the caption when they do not fit, never splitting it (#1233)', () => {
    render(<HeatMap {...props} caption="Work done per day" />)
    const row = screen.getByText('Work done per day').parentElement as HTMLElement
    expect(row.className).toContain('justify-between')
    expect(row.className).toContain('flex-wrap')
    expect(row.className).not.toMatch(/flex-col|sm:flex-row/)
    expect(screen.getByText('Less').parentElement?.className).toContain('shrink-0')
  })

  it('reads at a comfortable size on a phone: larger text in the full text colour, with room above (#1233, #1240)', () => {
    const { container } = render(<HeatMap {...props} caption="Work done per day" />)
    const row = screen.getByText('Work done per day').parentElement as HTMLElement
    expect(row.className).toContain('text-base')
    expect(row.className).not.toMatch(/text-(xs|sm)/)
    expect(row.className).toContain('pt-2')
    expect(row.className).not.toContain('pt-1')
    expect(row.className).toContain('text-foreground')
    expect(row.className).not.toContain('text-muted-foreground')
    for (const swatch of container.querySelectorAll('[data-heat-key-swatch]'))
      expect(swatch.className).toContain('size-4.5')
  })

  it('lines the calendar caption up with the first square and the key with the last, by sitting in the same grid as the rows (#1240)', () => {
    const { container } = render(<HeatMap {...props} caption="Work done per day" />)
    const keyRow = container.querySelector('[data-heat-key-row]') as HTMLElement
    const dateRow = container.querySelector('[data-heat-row]') as HTMLElement
    expect(keyRow.className).toBe(dateRow.className)
    expect(keyRow.children).toHaveLength(2)
    expect(keyRow.children[0].textContent).toBe('')
    expect(keyRow.children[1].className).toContain('col-span-7')
    expect(keyRow.children[1].contains(screen.getByText('Work done per day'))).toBe(true)
  })

  it('lets the week strip key span the full width, since it has no date column (#1240)', () => {
    const { container } = render(<HeatMap {...props} variant="week" caption="Work done per day" />)
    expect(container.querySelector('[data-heat-key-row]')).toBeNull()
    expect(screen.getByText('Work done per day')).toBeTruthy()
  })

  it('fills the width of its box, so the squares stretch with the graphs above', () => {
    const { container } = render(<HeatMap {...props} caption="Work done per day" />)
    const group = container.firstElementChild as HTMLElement
    expect(group.className).not.toContain('justify-center')
    expect((group.firstElementChild as HTMLElement).className).toContain('w-full')
    for (const cell of cells(container)) expect(cell.className).toContain('w-full')
  })

  it('shows nothing extra without a caption', () => {
    render(<HeatMap {...props} />)
    expect(screen.queryByText('Less')).toBeNull()
  })

  it('has no axe violations with a caption', async () => {
    const { container } = render(<HeatMap {...props} caption="Work done per day" />)
    await expectAccessible(container)
  })
})
