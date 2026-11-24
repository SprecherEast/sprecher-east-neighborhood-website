import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { geocoder, item, located, setup } from './placeHelpers.mjs'

// A locator that answers oddly, and the municipalities placement accepts (#1009).

describe('a locator that answers oddly', () => {
  it('keeps the word match, with a plain reason, for a status nobody expected', async () => {
    for (const answer of [{ status: 'weird' }, undefined, null]) {
      const { place, geocode } = setup({ geocode: geocoder(() => answer) })
      const out = await place(located('7035 Littlemore Dr', { coverage: 'catchment' }), item())
      assert.equal(out.placement.method, 'word-match')
      assert.match(out.placement.reason, /no usable answer/)
      assert.equal(geocode.asked.length, 1)
    }
  })

  it('counts a locator that throws as a failure, and goes on with the word match', async () => {
    const boom = geocoder(() => {
      throw new Error('socket hang up 7035 Littlemore Dr')
    })
    const { place, problems } = setup({ geocode: boom })
    for (const address of ['7035 Littlemore Dr', '100 Inside Edge Rd', '200 Outside Edge Rd']) {
      const out = await place(located(address), item())
      assert.equal(out.placement.method, 'word-match')
    }
    assert.deepEqual(problems, ["The City's locator failed; items are placed by word match."])
    assert.equal(boom.asked.length, 2)
  })

  it('places nothing by the boundary when no boundary is loaded, and says so', async () => {
    const { place, geocode, problems } = setup({ boundary: null })
    const out = await place(located('7035 Littlemore Dr', { coverage: 'catchment' }), item())
    assert.deepEqual(
      [out.placement.method, out.placement.reason],
      ['word-match', 'no boundary is loaded'],
    )
    assert.deepEqual([geocode.asked, problems], [[], []])
  })
})

describe('the municipality', () => {
  it('is Madison in every usual way of writing it', async () => {
    for (const municipality of [
      'Madison',
      'MADISON',
      'City of Madison',
      'Madison, WI',
      'Madison WI',
      'Madison, Wisconsin',
      'Madison, WI 53718',
      'City of Madison, Wisconsin',
    ]) {
      const v = located('7035 Littlemore Dr')
      v.location.municipality = municipality
      const { place } = setup()
      assert.equal((await place(v, item())).placement.method, 'boundary', municipality)
    }
  })

  it('is not Madison for another place', async () => {
    for (const municipality of [
      'Madison, AL',
      'Madison, Minnesota',
      'Madisonville',
      'East Madison',
      'Village of Cottage Grove',
    ]) {
      const v = located('7035 Littlemore Dr')
      v.location.municipality = municipality
      const { place } = setup()
      assert.equal((await place(v, item())).placement.method, 'word-match', municipality)
    }
  })
})
