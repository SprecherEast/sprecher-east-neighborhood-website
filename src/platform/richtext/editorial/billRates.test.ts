import { describe, expect, it } from 'vitest'

import type { BillShareYear } from './billShare'
import { PROPS } from './billShareFixtures'
import { rateLinesFor, ratesTitleFor, toastFor, yearToastFor } from './billRates'
import { toastsOf } from './billToasts'

const { years } = PROPS
const [first, second] = years as [BillShareYear, BillShareYear]

describe('rateLinesFor', () => {
  it('gives one line per body, in the bill’s order, each with its own year in the earliest year', () => {
    const lines = rateLinesFor(years, 0)
    expect(lines.map((line) => line.key)).toEqual(['schools', 'city', 'county', 'matc'])
    expect(lines.every((line) => line.year === 2026 && !line.carried)).toBe(true)
  })

  it('shows the City’s own 2027 rate and carries the other bodies’ 2026 rates, labeled 2026', () => {
    const lines = rateLinesFor(years, 1)
    const city = lines.find((line) => line.key === 'city')
    const county = lines.find((line) => line.key === 'county')
    expect(city).toMatchObject({ year: 2027, carried: false, perThousand: '$6.93' })
    expect(county).toMatchObject({ year: 2026, carried: true, perThousand: '$2.36' })
  })

  it('writes each rate as a percent (a rate per $1,000 over ten) and in dollars per $1,000', () => {
    const [schools] = rateLinesFor(years, 0)
    expect(schools).toMatchObject({ name: 'Metropolitan Schools', percent: '0.868%' })
    expect(schools?.perThousand).toBe('$8.68')
  })

  it('leaves a body with no rate in any year as a line with no figures, so the panel keeps its height', () => {
    const lines = rateLinesFor([{ ...second, rates: { city: 6.93 } }], 0)
    const schools = lines.find((line) => line.key === 'schools')
    expect(schools).toMatchObject({ percent: null, perThousand: null, carried: false })
    expect(lines).toHaveLength(4)
  })

  it('gives the bill’s short form of a long name', () => {
    const matc = rateLinesFor(years, 0).find((line) => line.key === 'matc')
    expect(matc?.shortName).toBe('Madison College')
  })

  it('matches the rates the bill is worked out from', () => {
    // The panel and the bill must never disagree about which rate a body has in a year
    const county = rateLinesFor(years, 1).find((line) => line.key === 'county')
    expect(Number(county?.perThousand?.slice(1))).toBeCloseTo(first.rates.county ?? 0, 2)
  })
})

describe('yearToastFor (#1380)', () => {
  const toasts = toastsOf(undefined)

  it('says in a year that carries a rate over that the others’ rates are the year before’s, with the year filled in', () => {
    const shown = yearToastFor(years, 1, toasts)
    expect(shown?.toast).toBe(toasts.ratesCarried)
    expect(shown?.message).toBe(
      'These are the City’s 2027 rates. The others aren’t out yet, so we’re using 2026’s.',
    )
  })

  it('says nothing in a year where every rate is its own, unless the editor wrote a message for it (#1392)', () => {
    expect(yearToastFor(years, 0, toasts)).toBeNull()
    const written = toastsOf([
      { toast: 'ratesOwn', message: 'All four rates are the {year} rates.' },
    ])
    const shown = yearToastFor(years, 0, written)
    expect(shown?.toast).toBe(written.ratesOwn)
    expect(shown?.message).toBe('All four rates are the 2026 rates.')
  })

  it('has no toast for a year that does not exist, or one the editor turned off', () => {
    expect(yearToastFor(years, 5, toasts)).toBeNull()
    const off = toastsOf([{ toast: 'ratesOwn', message: '  ' }])
    expect(yearToastFor(years, 0, off)).toBeNull()
  })
})

describe('rateLinesFor with the rates counting between years (#1370)', () => {
  it('writes the figures from the rates it is given, and keeps the year and carried labels of the year shown', () => {
    const lines = rateLinesFor(years, 1, { city: 7.0, county: 2.5 })
    expect(lines.find((line) => line.key === 'city')).toMatchObject({
      percent: '0.700%',
      perThousand: '$7.00',
      year: 2027,
      carried: false,
    })
    expect(lines.find((line) => line.key === 'county')).toMatchObject({
      perThousand: '$2.50',
      year: 2026,
      carried: true,
    })
  })

  it('uses the year’s own rate for a body missing from the rates given, and gives no figures to a body with none', () => {
    const lines = rateLinesFor(years, 1, {})
    expect(lines.find((line) => line.key === 'city')?.perThousand).toBe('$6.93')
    const none = rateLinesFor([{ ...second, rates: { city: 6.93 } }], 0, { schools: 9 })
    expect(none.find((line) => line.key === 'schools')?.percent).toBeNull()
  })
})

describe('toastFor', () => {
  const toasts = toastsOf(undefined)

  it('fills the year shown and the earlier year whose rates stand in for the missing ones', () => {
    const shown = toastFor('ratesCarried', years, 1, toasts)
    expect(shown?.message).toContain('2027')
    expect(shown?.message).toContain('2026’s')
  })

  it('fills the year shown in a panel’s own warning', () => {
    expect(toastFor('aboutAnswer', years, 1, toasts)?.message).toContain('2027')
    expect(toastFor('aboutBill', years, 0, toasts)?.message).not.toContain('{')
  })

  it('has none for a year that does not exist, or a toast the editor turned off', () => {
    expect(toastFor('aboutRates', years, 9, toasts)).toBeNull()
    expect(toastFor('ratesOwn', years, 0, toasts)).toBeNull()
  })

  it('names the earlier year once when several bodies’ rates are from it', () => {
    const message = toastFor('ratesCarried', years, 1, toasts)?.message ?? ''
    expect(message.match(/2026/g)).toHaveLength(1)
  })
})

describe('ratesTitleFor', () => {
  const text = { title: '{year} rates', carriedTitle: '{year} city rate' }

  it('says it is the City’s rate when the other rates are an earlier year’s, and the year’s rates when all are its own', () => {
    expect(ratesTitleFor(years, 1, text)).toBe('2027 city rate')
    expect(ratesTitleFor(years, 0, text)).toBe('2026 rates')
  })

  it('shows the editor’s title as written when it has no blank', () => {
    expect(ratesTitleFor(years, 0, { title: 'Rates in use', carriedTitle: 'City rate' })).toBe(
      'Rates in use',
    )
  })
})
