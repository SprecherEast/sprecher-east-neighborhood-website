// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DayCount } from '../domain/dayFilter'
import { DayFilterMap } from './DayFilterMap.client'
import { PlanFilterProvider } from './PlanFilter.client'

afterEach(cleanup)

// Fri 2026-11-13 at noon in Chicago
const NOW = new Date('2026-11-13T18:00:00Z')
const activity: Record<string, DayCount> = {
  '2026-11-11': { finished: 1, opened: 0 },
  '2026-11-12': { finished: 3, opened: 1 },
  '2026-11-13': { finished: 2, opened: 2 },
}

function chooseDays(...names: RegExp[]) {
  render(
    <PlanFilterProvider parentOf={{}}>
      <DayFilterMap activity={activity} now={NOW} since="2026-11-11" />
    </PlanFilterProvider>,
  )
  for (const name of names) fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('list', { name: 'Days chosen' })
}

describe('the chosen-day pills', () => {
  it('sit in one wrapping row, so they share a line until it is full', () => {
    const list = chooseDays(/^Wed, Nov 11/, /^Thu, Nov 12/, /^Fri, Nov 13/)
    expect(list.className).toContain('flex-wrap')
    expect(list.className).not.toContain('flex-col')
    expect(list.querySelectorAll('li')).toHaveLength(3)
    for (const pill of list.querySelectorAll('button')) {
      expect(pill.className).not.toContain('w-full')
    }
  })

  it('show the short date, and keep the weekday and both counts in the spoken name', () => {
    const list = chooseDays(/^Thu, Nov 12/)
    const pill = list.querySelector('button') as HTMLElement
    expect(pill.textContent).toContain('Nov 12')
    expect(pill.textContent).not.toContain('Thu')
    expect(pill.getAttribute('aria-label')).toBe('Remove Thu, Nov 12: 3 finished, 1 opened')
  })

  it('are compact: tighter padding and gaps than a default small button', () => {
    const pill = chooseDays(/^Thu, Nov 12/).querySelector('button') as HTMLElement
    expect(pill.className).toContain('px-3')
    expect(pill.className).toContain('gap-1.5')
  })
})
