import { describe, expect, it } from 'vitest'

import { computeBillShare, fillFromEarlier, parseHomeValue, type MillRates } from './billShare'

const ALL: MillRates = { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 }

describe('parseHomeValue', () => {
  it.each([
    ['500300', 500300],
    ['$500,300', 500300],
    [' 481,300 ', 481300],
    ['250000.4', 250000],
  ])('reads %s as %d', (text, value) => expect(parseHomeValue(text)).toBe(value))

  it.each(['', '   ', 'abc', '0', '-5', '1e3', '$', '999999999999'])('refuses %j', (text) =>
    expect(parseHomeValue(text)).toBeNull(),
  )
})

describe('computeBillShare', () => {
  it('multiplies the value by each body’s rate per $1,000', () => {
    const bill = computeBillShare(481300, ALL)
    expect(bill.complete).toBe(true)
    const city = bill.parts.find((p) => p.key === 'city')
    expect(city?.amount).toBeCloseTo(3375.89, 0)
    expect(bill.total).toBeCloseTo(
      bill.parts.reduce((sum, p) => sum + (p.amount ?? 0), 0),
      6,
    )
  })

  it('gives whole percents that add up to 100, in the order schools, City, county, MATC', () => {
    const bill = computeBillShare(481300, ALL)
    expect(bill.parts.map((p) => p.key)).toEqual(['schools', 'city', 'county', 'matc'])
    expect(bill.parts.map((p) => p.percent)).toEqual([46, 38, 13, 3])
    expect(bill.parts.reduce((s, p) => s + (p.percent ?? 0), 0)).toBe(100)
  })

  it('keeps each body’s exact share for the bar’s widths', () => {
    const bill = computeBillShare(500000, ALL)
    const shares = bill.parts.map((p) => p.share ?? 0)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6)
    expect(shares[1]).toBeCloseTo((7.0139 / 18.667) * 100, 3)
  })

  it('scales the amounts with the home’s value but not the shares', () => {
    const a = computeBillShare(200000, ALL)
    const b = computeBillShare(400000, ALL)
    expect(b.total).toBeCloseTo((a.total ?? 0) * 2, 6)
    expect(b.parts.map((p) => p.percent)).toEqual(a.parts.map((p) => p.percent))
  })

  it('is incomplete when a body has not set its rate: only the set amounts are known', () => {
    const bill = computeBillShare(500300, { city: 6.93 })
    expect(bill.complete).toBe(false)
    expect(bill.total).toBeNull()
    expect(bill.missing).toEqual(['schools', 'county', 'matc'])
    const city = bill.parts.find((p) => p.key === 'city')
    expect(city?.amount).toBeCloseTo(3467.0, 0)
    expect(city?.percent).toBeNull()
    expect(bill.parts.find((p) => p.key === 'schools')?.amount).toBeNull()
  })
})

describe('fillFromEarlier', () => {
  it('takes each rate that is not set from the earlier year and says which', () => {
    const filled = fillFromEarlier({ city: 6.93 }, ALL)
    expect(filled.rates).toEqual({ ...ALL, city: 6.93 })
    expect(filled.filled).toEqual(['schools', 'county', 'matc'])
  })

  it('changes nothing when every rate is set, or there is no earlier year', () => {
    expect(fillFromEarlier(ALL, { city: 1 })).toEqual({ rates: ALL, filled: [] })
    expect(fillFromEarlier({ city: 6.93 }, undefined)).toEqual({
      rates: { city: 6.93 },
      filled: [],
    })
  })
})
