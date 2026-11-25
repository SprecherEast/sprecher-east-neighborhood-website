import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { geocoder, item, located, record, setup } from './placeHelpers.mjs'
import { INSIDE } from './geoFixtures.mjs'
import { candidate } from './fixtures.mjs'

// What the placer reads, and the order of its checks (#1009; coverage.md, Review passes, check 2):
// the street comes only from verify's address or the candidate's location text, never from the
// candidate's title or text; a later refusal never hides an earlier one; a period closes a street.

const asked = async (address, overrides = () => {}, text = null) => {
  const { place, geocode } = setup()
  const v = located(address)
  overrides(v)
  const placed = await place(v, item(text))
  return { geocode, placed }
}

describe('the candidate’s title and text are never read for a street', () => {
  it('sends nothing for a street only in the title or the source text', async () => {
    for (const given of [
      { title: 'Meeting at 7035 Littlemore Dr', sourceText: 'Bring a book.' },
      { title: 'Meeting', sourceText: 'At 7035 Littlemore Dr tonight.' },
    ])
      for (const locationText of [null, '', '   ']) {
        const { place, geocode } = setup()
        const v = located(null, { coverage: 'unknown' })
        const placed = await place(v, candidate({ ...given, locationText }))
        assert.deepEqual(geocode.asked, [], JSON.stringify(given))
        assert.equal(placed.coverage, 'unknown')
        assert.deepEqual(placed.flags, [])
        assert.equal(placed.placement.reason, 'no street address in the item')
      }
  })

  it('does not take a street from the municipality either', async () => {
    const { geocode, placed } = await asked(null, (v) => {
      v.location.municipality = '7035 Littlemore Dr'
    })
    assert.deepEqual(geocode.asked, [])
    assert.equal(placed.placement.reason, 'the municipality is not Madison, Wisconsin')
    const empty = await asked(null, (v) => {
      v.location.municipality = null
    })
    assert.deepEqual(empty.geocode.asked, [])
    assert.equal(empty.placed.placement.reason, 'no street address in the item')
  })

  it('takes the candidate’s location text when verify has no address, and verify’s address first', async () => {
    const fallback = await asked(null, () => {}, '7035 Littlemore Dr, Madison')
    assert.deepEqual(fallback.geocode.asked, ['7035 Littlemore Dr'])
    const own = await asked('100 Inside Edge Rd', () => {}, '7035 Littlemore Dr, Madison')
    assert.deepEqual(own.geocode.asked, ['100 Inside Edge Rd'])
  })
})

describe('periods around the street', () => {
  it('reads a period after the street and one at the end of the text, together', async () => {
    for (const address of [
      '7035 Littlemore Dr., Madison.',
      '7035 Littlemore Dr. Madison.',
      '7035 Littlemore Dr.',
    ]) {
      const { geocode } = await asked(address)
      assert.deepEqual(geocode.asked, ['7035 Littlemore Dr'], address)
    }
  })
})

describe('a unit after a #', () => {
  it('holds no space, as after a word', async () => {
    for (const unit of ['#4 5', '# 4 5', '#4 B'])
      assert.deepEqual(
        (await asked(`7035 Littlemore Dr, ${unit}, Madison`)).geocode.asked,
        [],
        unit,
      )
    assert.deepEqual((await asked('7035 Littlemore Dr, # 4B, Madison')).geocode.asked, [
      '7035 Littlemore Dr',
    ])
  })
})

describe('the order of the checks in front of a request', () => {
  it('answers a street already answered, even when the run is out of time', async () => {
    const { place, geocode } = setup()
    await place(located('7035 Littlemore Dr'), item())
    const again = await place(located('7035 Littlemore Dr'), item(), { deadline: Date.now() - 1 })
    assert.equal(geocode.asked.length, 1)
    assert.equal(again.placement.method, 'boundary')
  })

  it('says the run is out of time before it says the locator failed', async () => {
    const { place } = setup({ geocode: geocoder(() => ({ status: 'failed' })) })
    await place(located('7035 Littlemore Dr'), item())
    await place(located('100 Inside Edge Rd'), item())
    const out = await place(located('200 Outside Edge Rd'), item(), { deadline: Date.now() - 1 })
    assert.equal(out.placement.reason, 'the run is out of time for another locator request')
  })

  it('says the locator failed before it says the limit was reached', async () => {
    const small = { ...record, geocoder: { ...record.geocoder, maxPerRun: 2 } }
    const { place } = setup({ geocode: geocoder(() => ({ status: 'failed' })), record: small })
    await place(located('7035 Littlemore Dr'), item())
    await place(located('100 Inside Edge Rd'), item())
    const out = await place(located('200 Outside Edge Rd'), item())
    assert.equal(out.placement.reason, 'the locator failed earlier in this run')
  })

  it('says the address is not plain before it says it names another place', async () => {
    const long = `Wisconsin 7035 ${'A'.repeat(40)} ${'B'.repeat(40)} Dr`
    const { geocode, placed } = await asked(long)
    assert.deepEqual(geocode.asked, [])
    assert.equal(placed.placement.reason, 'the address is not a plain street address')
  })
})

describe('an answered street', () => {
  it('is not asked again after an unrelated failure', async () => {
    const answers = { '7035 Littlemore Dr': { status: 'match', point: INSIDE } }
    const geocode = geocoder((street) => answers[street] ?? { status: 'failed' })
    const { place } = setup({ geocode })
    await place(located('7035 Littlemore Dr'), item())
    await place(located('100 Inside Edge Rd'), item())
    const again = await place(located('7035 Littlemore Dr'), item())
    assert.deepEqual(geocode.asked, ['7035 Littlemore Dr', '100 Inside Edge Rd'])
    assert.equal(again.placement.method, 'boundary')
  })
})

describe('the length of a street', () => {
  it('sends a plain street of 61 to 80 characters', async () => {
    const street = `7035 ${'A'.repeat(20)} ${'B'.repeat(20)} ${'C'.repeat(16)} Dr`
    assert.equal(street.length, 66)
    const { geocode } = await asked(street)
    assert.deepEqual(geocode.asked, [street])
  })
})
