// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { DayCount } from '../domain/dayFilter'
import { DayFilterMap } from './DayFilterMap.client'
import { PlanFilterProvider } from './PlanFilter.client'

afterEach(cleanup)

// Fri 2026-11-13 at noon in Chicago
const NOW = new Date('2026-11-13T18:00:00Z')

const activity: Record<string, DayCount> = {
  '2026-11-12': { finished: 3, opened: 1 },
  '2026-10-15': { finished: 2, opened: 0 },
  '2026-09-20': { finished: 1, opened: 1 },
}

const renderMap = (since: string | null = '2026-09-20') =>
  render(
    <PlanFilterProvider parentOf={{}}>
      <DayFilterMap activity={activity} now={NOW} since={since} />
    </PlanFilterProvider>,
  )

const earlier = () => screen.getByRole('button', { name: 'Earlier month' })
const dayButtons = () => screen.getAllByRole('button', { pressed: false })

describe('DayFilterMap month browsing', () => {
  it('starts on the last four weeks, with going forward unavailable', () => {
    renderMap()
    expect(screen.getByText('Last four weeks')).toBeTruthy()
    expect(screen.getByRole('group', { name: /^Activity over four weeks/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Later month' }).getAttribute('aria-disabled')).toBe(
      'true',
    )
  })

  it('steps back one full calendar month at a time and forward again', () => {
    renderMap()
    fireEvent.click(earlier())
    expect(screen.getByText('October 2026')).toBeTruthy()
    expect(
      screen.getByRole('group', {
        name: /^Activity in October 2026, issues finished each day: (0, ){14}2,/,
      }),
    ).toBeTruthy()
    fireEvent.click(earlier())
    expect(screen.getByText('September 2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Later month' }))
    expect(screen.getByText('October 2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the last four weeks' }))
    expect(screen.getByText('Last four weeks')).toBeTruthy()
  })

  it('stops going back at the month of the first activity', () => {
    renderMap('2026-10-15')
    fireEvent.click(earlier())
    expect(screen.getByText('October 2026')).toBeTruthy()
    expect(earlier().getAttribute('aria-disabled')).toBe('true')
  })

  it('cannot go back when everything happened this month', () => {
    renderMap('2026-11-12')
    expect(earlier().getAttribute('aria-disabled')).toBe('true')
  })

  it('offers every day of the month to press, none still to come', () => {
    const { container } = renderMap()
    fireEvent.click(earlier())
    expect(dayButtons()).toHaveLength(31)
    expect(container.querySelectorAll('[data-heat-future]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-heat-cell]')).toHaveLength(31)
  })

  it('keeps a chosen day, with its counts, while browsing to another month', () => {
    renderMap()
    fireEvent.click(screen.getByRole('button', { name: /12 Nov|Nov 12|November 12/ }))
    fireEvent.click(earlier())
    expect(screen.getByRole('button', { name: /^Remove .*3 finished, 1 opened/ })).toBeTruthy()
  })

  it('has no accessibility violations on a past month', async () => {
    const { container } = renderMap()
    fireEvent.click(earlier())
    await expectAccessible(container)
  })
})
