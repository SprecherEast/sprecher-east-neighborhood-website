// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HeatMap, type HeatMapProps, mondayIndex } from './HeatMap'
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

describe('HeatMap selectable', () => {
  const values = [0, 1, 2, 3, 4, 5, 6]
  const show = (selection: Partial<NonNullable<HeatMapProps['selection']>> = {}) => {
    const onToggle = vi.fn()
    const view = render(
      <HeatMap
        variant="week"
        days={week}
        values={values}
        label="Finished each day"
        selection={{ selected: [], onToggle, ...selection }}
      />,
    )
    return { ...view, onToggle }
  }

  it('is a named group with one pressed-state button per day, none pressed by default', () => {
    show()
    expect(screen.getByRole('group', { name: 'Finished each day' })).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(7)
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(buttons[4].getAttribute('aria-label')).toBe('Fri, Nov 13: 4')
  })

  it('marks the selected days pressed and ringed, and reports a press with its day', () => {
    const { onToggle } = show({ selected: ['2026-11-13'] })
    const friday = screen.getByRole('button', { name: 'Fri, Nov 13: 4' })
    expect(friday.getAttribute('aria-pressed')).toBe('true')
    expect(friday.className).toContain('ring-2')
    fireEvent.click(screen.getByRole('button', { name: 'Thu, Nov 12: 3' }))
    expect(onToggle).toHaveBeenCalledWith('2026-11-12')
  })

  it('makes the days that are not enabled unavailable: disabled, named so, and never pressed', () => {
    const { onToggle } = show({
      selected: ['2026-11-13'],
      enabled: ['2026-11-12', '2026-11-13'],
      unavailableReason: 'not selected above',
    })
    const monday = screen.getByRole('button', {
      name: 'Mon, Nov 9: 0, not available, not selected above',
    })
    expect(monday).toHaveProperty('disabled', true)
    fireEvent.click(monday)
    expect(onToggle).not.toHaveBeenCalled()
    expect(
      screen.getAllByRole('button').filter((b) => !(b as HTMLButtonElement).disabled),
    ).toHaveLength(2)
  })

  it('keeps a pressed day that cannot be pressed in its shade and ring, not slashed', () => {
    show({ selected: ['2026-11-13'], enabled: [] })
    const friday = screen.getByRole('button', { name: 'Fri, Nov 13: 4' })
    expect(friday).toHaveProperty('disabled', true)
    expect(friday.getAttribute('aria-pressed')).toBe('true')
    expect(friday.className).toContain('ring-2')
    expect(friday.querySelector('.lucide-slash')).toBeNull()
    expect(friday.querySelector('[data-heat-selected]')).not.toBeNull()
    expect(screen.getByRole('button', { name: /^Thu, Nov 12: 3, not available/ })).toBeTruthy()
  })

  it('makes the calendar days pressable too and leaves the days to come out of it', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <HeatMap
        variant="calendar"
        days={week.slice(0, 5)}
        values={[0, 1, 2, 3, 4]}
        label="Four weeks"
        selection={{ selected: [], onToggle }}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(container.querySelectorAll('[data-heat-future]').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Wed, Nov 11: 2' }))
    expect(onToggle).toHaveBeenCalledWith('2026-11-11')
  })

  it('passes an accessibility check, with a selection and with unavailable days', async () => {
    const { container } = show({ selected: ['2026-11-12'], enabled: ['2026-11-12', '2026-11-13'] })
    await expectAccessible(container)
  })
})

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

  it('keeps the caption and the key on one line, the caption left and the key right, at every width', () => {
    render(<HeatMap {...props} caption="Work done per day" />)
    const row = screen.getByText('Work done per day').parentElement as HTMLElement
    expect(row.className).toContain('justify-between')
    expect(row.className).not.toMatch(/flex-col|sm:flex-row/)
    expect(row.className).not.toContain('flex-wrap')
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
