import { describe, expect, it } from 'vitest'

import { blendRates, ratesAtPosition } from './rateBlend'

const from = { schools: 8, county: 2, matc: 0.5, city: 7 }
const to = { schools: 9, county: 2, matc: 0.5, city: 6 }

describe('blendRates', () => {
  it('is the first rates at 0 and the second at 1', () => {
    expect(blendRates(from, to, 0)).toEqual(from)
    expect(blendRates(from, to, 1)).toEqual(to)
  })

  it('moves each rate in a straight line between the two', () => {
    expect(blendRates(from, to, 0.5)).toEqual({ schools: 8.5, county: 2, matc: 0.5, city: 6.5 })
  })

  it('takes the new rates whole when a body has a rate in only one of them', () => {
    expect(blendRates({ city: 7 }, to, 0.5)).toEqual(to)
  })
})

describe('ratesAtPosition', () => {
  const years = [from, to]

  it('is a year’s own rates at a whole position', () => {
    expect(ratesAtPosition(years, 0)).toEqual(from)
    expect(ratesAtPosition(years, 1)).toEqual(to)
  })

  it('is a blend of the two neighbours between years, and never past the ends', () => {
    expect(ratesAtPosition(years, 0.5)).toEqual({ schools: 8.5, county: 2, matc: 0.5, city: 6.5 })
    expect(ratesAtPosition(years, 7)).toEqual(to)
    expect(ratesAtPosition(years, -1)).toEqual(from)
  })
})
