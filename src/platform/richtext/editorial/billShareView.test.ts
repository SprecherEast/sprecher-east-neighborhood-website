import { describe, expect, it } from 'vitest'

import { computeBillShare } from '@/platform/lib/billShare'

import { receiptFor } from './billShareView'

const RATES = { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 }

describe('receiptFor', () => {
  it('lists the City first, then schools, County and Madison College, with whole-dollar amounts', () => {
    const receipt = receiptFor(computeBillShare(500300, RATES), 500300)
    expect(receipt.slices.map((slice) => slice.key)).toEqual(['city', 'schools', 'county', 'matc'])
    expect(receipt.slices[0]).toMatchObject({ name: 'City of Madison', tone: 'highlight' })
    expect(receipt.total).toEqual({ label: 'Total property tax', amount: '$9,339' })
    expect(receipt.slices.map((slice) => slice.tone)).toEqual([
      'highlight',
      'light',
      'medium',
      'strong',
    ])
  })

  it('names every slice, its dollars and its percent for screen readers', () => {
    const { label } = receiptFor(computeBillShare(500300, RATES), 500300)
    expect(label).toMatch(
      /^Your whole property tax bill: City of Madison \$3,5\d\d, \d+%; Metropolitan Schools/,
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
