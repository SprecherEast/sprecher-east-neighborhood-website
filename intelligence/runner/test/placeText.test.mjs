import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { boundaryProblems } from '../lib/boundary.mjs'
import { createPlacer } from '../lib/place.mjs'
import { boundary, geocoder, item, located, record, setup } from './placeHelpers.mjs'
import { dataWith, loose } from './boundaryHelpers.mjs'

// Where the street is read from, what counts as "before the street", and which refusal is
// recorded first when two apply (#1009; coverage.md, Review passes, check 2).

const sent = async (address, candidateText = null) => {
  const { place, geocode } = setup()
  await place(located(address), item(candidateText))
  return geocode.asked
}

describe('where the street is read from', () => {
  it('never reads the place’s name: a street only in the name sends nothing and raises nothing', async () => {
    const { place, geocode } = setup()
    const v = located(null, { coverage: 'unknown' })
    v.location.name = '7035 Littlemore Dr'
    const placed = await place(v, item(null))
    assert.deepEqual(geocode.asked, [])
    assert.equal(placed.placement.method, 'word-match')
    assert.equal(placed.coverage, 'unknown')
    assert.deepEqual(placed.flags, [])
  })

  it('does not read the name even when the candidate’s text has no street either', async () => {
    const { place, geocode } = setup()
    const v = located(null, { coverage: 'catchment' })
    v.location.name = '7035 Littlemore Dr'
    const placed = await place(v, item('at the shelter'))
    assert.deepEqual(geocode.asked, [])
    assert.equal(placed.coverage, 'catchment')
  })
})

describe('what is before the street', () => {
  it('reads a street whose own words are Wisconsin or a five-digit house number', async () => {
    assert.deepEqual(await sent('100 Wisconsin Ave'), ['100 Wisconsin Ave'])
    assert.deepEqual(await sent('12345 Main St'), ['12345 Main St'])
    assert.deepEqual(await sent('7035 Littlemore Dr'), ['7035 Littlemore Dr'])
  })

  it('refuses a place or a five-digit number before the street', async () => {
    assert.deepEqual(await sent('Wisconsin 100 Main St'), [])
    assert.deepEqual(await sent('53718 100 Main St'), [])
    assert.deepEqual(await sent('Town of Burke, 100 Main St'), [])
  })
})

describe('a hyphen in a unit', () => {
  it('takes it after Apt, Unit and Suite as after a #', async () => {
    for (const unit of ['Apt 4-B', 'Unit 4-B', 'Suite 2-A', 'Rm 1-2'])
      assert.deepEqual(
        await sent(`7035 Littlemore Dr, ${unit}, Madison`),
        ['7035 Littlemore Dr'],
        unit,
      )
  })
})

describe('which refusal is recorded when two apply', () => {
  const reason = async (change, overrides = {}) => {
    const { place } = setup({ geocode: geocoder() })
    const v = located('7035 Littlemore Dr', overrides)
    change(v)
    return (await place(v, item())).placement.reason
  }
  it('the municipality before the flag', async () => {
    const reasonOf = await reason((v) => {
      v.location.municipality = 'Chicago'
      v.flags = ['similar-name']
    })
    assert.equal(reasonOf, 'the municipality is not Madison, Wisconsin')
  })

  it('the flag when the municipality is Madison', async () => {
    const reasonOf = await reason((v) => {
      v.flags = ['prompt-injection']
    })
    assert.equal(reasonOf, 'the item is flagged as a similar name or as an injection')
  })

  it('no boundary before the unverified record, and the record before the locator', async () => {
    const asked = (config) => createPlacer({ ...config, geocode: geocoder() })
    const v = () => located('7035 Littlemore Dr')
    const both = await asked({ boundary: null, record: { ...record, verified: false } })(
      v(),
      item(),
    )
    assert.equal(both.placement.reason, 'no boundary is loaded')
    const unverified = await asked({ boundary, record: { ...record, verified: false } })(
      v(),
      item(),
    )
    assert.equal(unverified.placement.reason, 'the boundary record is not verified')
    const noLocator = await createPlacer({
      boundary,
      record: { ...record, verified: false },
      geocode: null,
    })(v(), item())
    assert.equal(noLocator.placement.reason, 'the boundary record is not verified')
  })
})

describe('the orientation of a ring', () => {
  it('takes a clockwise ring as it takes a counter-clockwise one', () => {
    const ring = [
      [0, 0],
      [0, 0.1],
      [0.1, 0.1],
      [0.1, 0],
      [0, 0],
    ]
    assert.deepEqual(boundaryProblems(dataWith(ring), loose), [])
    assert.deepEqual(boundaryProblems(dataWith([...ring].reverse()), loose), [])
  })
})
