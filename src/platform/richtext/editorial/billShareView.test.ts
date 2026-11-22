import { describe, expect, it } from 'vitest'

import { computeBillShare } from '@/platform/lib/billShare'

import { ESTIMATE_BADGE, ratesBadgeFor, receiptFor } from './billShareView'

const RATES = { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0141 }

describe('receiptFor', () => {
  it('lists the bodies from the largest share to the smallest, with whole-dollar amounts and each body’s own tone (#1202)', () => {
    const receipt = receiptFor(computeBillShare(500300, RATES), 500300)
    expect(receipt.slices.map((slice) => slice.key)).toEqual(['schools', 'city', 'county', 'matc'])
    expect(receipt.slices[1]).toMatchObject({ name: 'City of Madison', tone: 'amber' })
    expect(receipt.total).toEqual({ label: 'Total property tax', amount: '$9,339' })
    expect(receipt.slices.map((slice) => slice.tone)).toEqual(['rust', 'amber', 'green', 'mint'])
  })

  it('follows the amounts: a bigger City rate puts the City first, and equal shares keep City, schools, county, Madison College (#1202)', () => {
    const bigCity = receiptFor(computeBillShare(500300, { ...RATES, city: 12 }), 500300)
    expect(bigCity.slices.map((slice) => slice.key)).toEqual(['city', 'schools', 'county', 'matc'])
    const equal = { schools: 5, county: 5, matc: 5, city: 5 }
    const tied = receiptFor(computeBillShare(500300, equal), 500300)
    expect(tied.slices.map((slice) => slice.key)).toEqual(['city', 'schools', 'county', 'matc'])
  })

  it('names every slice, its dollars and its percent for screen readers', () => {
    const { label } = receiptFor(computeBillShare(500300, RATES), 500300)
    expect(label).toMatch(
      /^Your whole property tax bill: Metropolitan Schools \$\d,\d{3}, \d+%; City of Madison \$3,5\d\d, /,
    )
  })

  it('says the whole bill for a complete bill, and only the City’s part for an incomplete one', () => {
    expect(receiptFor(computeBillShare(500000, RATES), 500000).summary).toMatch(
      /^If your home is worth \$500,000, your whole bill is about \$\d/,
    )
    expect(receiptFor(computeBillShare(500000, { city: 6.93 }), 500000).summary).toMatch(
      /^The City’s part of a \$500,000 home’s bill would be about \$3,465\.$/,
    )
  })

  it('has no slices, total or sentence when there is no bill', () => {
    expect(receiptFor(null, null)).toEqual({
      slices: [],
      total: null,
      label: '',
      summary: '',
    })
  })

  it('has no slices or total while a body has no rate, but still the City’s sentence', () => {
    const receipt = receiptFor(computeBillShare(500000, { city: 6.93 }), 500000)
    expect(receipt.slices).toEqual([])
    expect(receipt.total).toBeNull()
  })
})

describe('ratesBadgeFor (#1417)', () => {
  it('is the Estimate tag for a year with a note, whatever the note says', () => {
    expect(ratesBadgeFor('proposed', false)).toEqual(ESTIMATE_BADGE)
    expect(ESTIMATE_BADGE).toEqual({ certainty: 'estimate' })
  })

  it('is the Estimate tag for a year that uses an earlier year’s rate for some body, note or none', () => {
    expect(ratesBadgeFor('', true)).toEqual(ESTIMATE_BADGE)
    expect(ratesBadgeFor(undefined, true)).toEqual(ESTIMATE_BADGE)
  })

  it('shows nothing for a year with no note and every rate its own: nothing to flag', () => {
    expect(ratesBadgeFor('', false)).toBeNull()
    expect(ratesBadgeFor('  ', false)).toBeNull()
    expect(ratesBadgeFor(undefined, false)).toBeNull()
  })
})
