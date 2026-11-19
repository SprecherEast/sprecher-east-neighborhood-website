import { describe, expect, it } from 'vitest'

import { earliestStep, mapWindow } from './mapWindow'

// Fri 2026-11-13 noon in Chicago
const NOW = new Date('2026-11-13T18:00:00Z')

describe('mapWindow', () => {
  it('is the rolling four weeks ending today at step 0', () => {
    const { days, title } = mapWindow(NOW, 0)
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-10-17')
    expect(days.at(-1)).toBe('2026-11-13')
    expect(title).toBe('Last four weeks')
  })

  it('is the whole previous month at step 1, then one month further each step', () => {
    const october = mapWindow(NOW, 1)
    expect(october.title).toBe('October 2026')
    expect(october.days).toHaveLength(31)
    expect([october.days[0], october.days.at(-1)]).toEqual(['2026-10-01', '2026-10-31'])
    const september = mapWindow(NOW, 2)
    expect(september.title).toBe('September 2026')
    expect(september.days).toHaveLength(30)
  })

  it('crosses a year and knows a leap February', () => {
    const jan = new Date('2028-03-10T18:00:00Z')
    expect(mapWindow(jan, 1).days).toHaveLength(29)
    expect(mapWindow(jan, 1).title).toBe('February 2028')
    expect(mapWindow(jan, 3).title).toBe('December 2027')
    expect(mapWindow(jan, 3).days[0]).toBe('2027-12-01')
  })

  it('reads the site calendar, not the clock in UTC', () => {
    // 2026-12-01 02:00 UTC is still Nov 30 in Chicago
    const late = new Date('2026-12-01T02:00:00Z')
    expect(mapWindow(late, 1).title).toBe('October 2026')
  })
})

describe('earliestStep', () => {
  it('is how many months back the first day of data lies', () => {
    expect(earliestStep(NOW, '2026-11-02')).toBe(0)
    expect(earliestStep(NOW, '2026-10-31')).toBe(1)
    expect(earliestStep(NOW, '2026-07-04')).toBe(4)
  })

  it('is 0 when there is no data or it lies in the future', () => {
    expect(earliestStep(NOW, null)).toBe(0)
    expect(earliestStep(NOW, '2027-01-01')).toBe(0)
  })
})
