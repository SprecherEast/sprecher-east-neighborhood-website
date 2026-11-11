import { describe, expect, it } from 'vitest'

import { toBillShareProps, type StoredBillShare } from './billShare'

const stored = (years: Record<string, unknown>[], intro = 'Based on the City’s average home.') =>
  ({ intro, years }) as unknown as StoredBillShare

const year = (extra: Record<string, unknown> = {}) => ({
  year: 2026,
  label: '2026 rates',
  averageHome: 481300,
  schools: 8.6814,
  county: 2.3564,
  matc: 0.6153,
  city: 7.0139,
  linkLabel: 'City tax detail',
  linkUrl: 'https://example.org/tax',
  ...extra,
})

describe('toBillShareProps', () => {
  it('reads each year’s average home, rates and source link', () => {
    const { intro, years } = toBillShareProps(stored([year()]))
    expect(intro).toBe('Based on the City’s average home.')
    expect(years).toHaveLength(1)
    expect(years[0]).toMatchObject({
      year: 2026,
      label: '2026 rates',
      averageHome: 481300,
      rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 },
      source: { label: 'City tax detail', href: 'https://example.org/tax' },
    })
  })

  it('reads a year’s note for under its switch, and none when it is empty', () => {
    const { years } = toBillShareProps(
      stored([year({ note: ' proposed ' }), year({ year: 2027, note: '  ' })]),
    )
    expect(years[0]?.note).toBe('proposed')
    expect(years[1]?.note).toBe('')
  })

  it('leaves a rate that is empty out, so the picture says it is not set', () => {
    const { years } = toBillShareProps(
      stored([year({ year: 2027, schools: null, county: undefined, matc: 0, city: 6.93 })]),
    )
    expect(years[0]?.rates).toEqual({ city: 6.93 })
  })

  it('drops a year with no average home or no year, and a bad link', () => {
    const { years } = toBillShareProps(
      stored([year({ averageHome: 0 }), year({ year: null }), year({ linkUrl: 'javascript:x' })]),
    )
    expect(years).toHaveLength(1)
    expect(years[0]?.source).toBeNull()
  })

  it('has no years when nothing is stored', () => {
    expect(toBillShareProps({}).years).toEqual([])
  })
})
