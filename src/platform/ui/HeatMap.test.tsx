// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HeatMap, mondayIndex } from './HeatMap'
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

describe('mondayIndex', () => {
  it('is 0 for Monday and 6 for Sunday', () => {
    expect(mondayIndex('2026-11-09')).toBe(0)
    expect(mondayIndex('2026-11-15')).toBe(6)
  })
})

describe('HeatMap week', () => {
  it('is a named image and draws one square per day with weekday letters', () => {
    const { container } = render(
      <HeatMap
        variant="week"
        days={week}
        values={[0, 1, 2, 3, 4, 5, 6]}
        label="Finished this week: 0, 1, 2"
      />,
    )
    expect(screen.getByRole('img', { name: 'Finished this week: 0, 1, 2' })).toBeTruthy()
    expect(cells(container)).toHaveLength(7)
    expect(container.textContent).toBe('MTWTFSS')
  })

  it('shades busier days darker, keeps a zero faint, and rings only the last day', () => {
    const { container } = render(
      <HeatMap variant="week" days={week} values={[0, 1, 0, 0, 0, 0, 4]} label="x" />,
    )
    const [zero, some, , , , , most] = cells(container)
    expect(zero.className).toContain('bg-done/10')
    expect(some.className).not.toBe(most.className)
    expect(most.className).toMatch(/bg-done(\s|$)/)
    expect(cells(container).filter((c) => c.className.includes('ring-2'))).toEqual([most])
  })

  it('shades by the shared max when given', () => {
    const { container } = render(
      <HeatMap variant="week" days={week} values={[1, 0, 0, 0, 0, 0, 0]} max={10} label="x" />,
    )
    expect(cells(container)[0].className).toContain('bg-done/30')
  })

  it('shows every day as faint when nothing happened', () => {
    const { container } = render(
      <HeatMap variant="week" days={week} values={[0, 0, 0, 0, 0, 0, 0]} label="x" />,
    )
    expect(cells(container).every((c) => c.className.includes('bg-done/10'))).toBe(true)
  })
})

describe('HeatMap calendar', () => {
  // Wed 2026-11-04 to Sat 2026-11-14: rows start on Mondays, Nov 2 / 9
  const days = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'].map(
    (d) => `2026-11-${d}`,
  )

  it('lays days out in Monday rows named by their Monday, with the days to come dashed', () => {
    const { container } = render(
      <HeatMap variant="calendar" days={days} values={days.map(() => 1)} label="x" />,
    )
    const rows = [...container.querySelectorAll('[data-heat-row]')]
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual(['2', '9'])
    expect(cells(container)).toHaveLength(11)
    expect(container.querySelectorAll('[data-heat-future]')).toHaveLength(1)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <HeatMap variant="calendar" days={days} values={days.map((_, i) => i)} label="Activity" />,
    )
    await expectAccessible(container)
  })

  it('names a row by its real Monday across a month boundary', () => {
    // Sun 2026-11-01 sits in the week of Mon 2026-10-26; Tue 2026-12-01 in the week of Mon 2026-11-30
    for (const [first, monday] of [
      ['2026-11-01', '26'],
      ['2026-12-01', '30'],
    ]) {
      const { container } = render(
        <HeatMap variant="calendar" days={[first]} values={[1]} label="x" />,
      )
      expect(container.querySelector('[data-heat-row]')?.firstElementChild?.textContent).toBe(
        monday,
      )
      cleanup()
    }
  })

  it('leaves the days before the first one blank and dashes only the days after the last', () => {
    // Wed to Fri of one week: Mon and Tue are blank, Sat and Sun are still to come
    const { container } = render(
      <HeatMap
        variant="calendar"
        days={['2026-11-11', '2026-11-12', '2026-11-13']}
        values={[1, 1, 1]}
        label="x"
      />,
    )
    expect(container.querySelectorAll('[data-heat-future]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-heat-cell]')).toHaveLength(3)
  })

  it('rings the last day', () => {
    const { container } = render(
      <HeatMap variant="calendar" days={days} values={days.map(() => 1)} label="x" />,
    )
    expect(cells(container).filter((c) => c.className.includes('ring-2'))).toEqual([
      cells(container).at(-1),
    ])
  })
})

describe('HeatMap week with fewer than seven days', () => {
  it('draws one square per day it is given', () => {
    const { container } = render(
      <HeatMap variant="week" days={week.slice(0, 3)} values={[1, 2, 3]} label="x" />,
    )
    expect(cells(container)).toHaveLength(3)
    expect(container.textContent).toBe('MTW')
  })
})
