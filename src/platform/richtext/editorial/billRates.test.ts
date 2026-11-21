import { describe, expect, it } from 'vitest'

import type { BillShareYear } from './billShare'
import { PROPS } from './billShareFixtures'
import { rateLinesFor, ratesNoteFor } from './billRates'

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

describe('ratesNoteFor', () => {
  const template = 'The other {year} rates come out in January.'

  it('shows the note in a year that carries a rate over, with that year filled in', () => {
    expect(ratesNoteFor(years, 1, template)).toEqual({
      text: 'The other 2027 rates come out in January.',
      shown: true,
    })
  })

  it('keeps the note’s room, hidden, in a year that carries nothing, worded for the year that does', () => {
    expect(ratesNoteFor(years, 0, template)).toEqual({
      text: 'The other 2027 rates come out in January.',
      shown: false,
    })
  })

  it('has no note at all when no year carries a rate over, or the editor wrote none', () => {
    expect(ratesNoteFor([first], 0, template)).toBeNull()
    expect(ratesNoteFor(years, 1, '')).toBeNull()
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
