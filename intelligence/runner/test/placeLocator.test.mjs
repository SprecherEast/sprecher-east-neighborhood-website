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

describe('where the street address came from', () => {
  const nameOnly = (coverage, flags = []) => {
    const v = located(null, { coverage, flags })
    v.location.name = 'Community room'
    return v
  }

  it('never raises unknown from an address only the candidate’s text gives', async () => {
    const { place, geocode } = setup()
    const out = await place(nameOnly('unknown'), item('7035 Littlemore Dr'))
    assert.equal(geocode.asked.length, 1)
    assert.deepEqual(
      [out.placement.method, out.coverage, out.flags, out.placement.overrode],
      ['boundary', 'core', ['ambiguous-location'], true],
    )
  })

  it('raises unknown from the address verify gave and confirmed, and catchment from either', async () => {
    const { place } = setup()
    const own = located('7035 Littlemore Dr', { coverage: 'unknown', flags: [] })
    assert.deepEqual((await place(own, item())).flags, [])
    const raised = await place(nameOnly('catchment'), item('7035 Littlemore Dr'))
    assert.deepEqual([raised.coverage, raised.flags], ['core', []])
  })

  it('does not raise unknown from the candidate’s address even when verify confirmed a name', async () => {
    const { place } = setup()
    const v = nameOnly('unknown', ['unverified-claim'])
    v.location.verified = true
    const out = await place(v, item('Room 2, 100 Inside Edge Rd, Madison, WI 53718'))
    assert.deepEqual(out.flags, ['unverified-claim', 'ambiguous-location'])
  })

  it('sends no address that names another municipality, from either source', async () => {
    for (const [v, text] of [
      [nameOnly('unknown'), '7035 Littlemore Dr, Cottage Grove, WI'],
      [nameOnly('unknown'), '7035 Littlemore Dr, Town of Blooming Grove'],
      [nameOnly('unknown'), '7035 Littlemore Dr, Madison Heights'],
      [nameOnly('unknown'), '7035  LITTLEMORE   DR,  COTTAGE GROVE'],
      [located('7035 Littlemore Dr, Cottage Grove, WI', { coverage: 'unknown' }), null],
      [located('7035 Littlemore Dr, Monona', { coverage: 'core' }), null],
    ]) {
      const { place, geocode } = setup()
      const out = await place(v, item(text))
      assert.deepEqual(geocode.asked, [], String(text))
      assert.equal(out.placement.method, 'word-match')
      assert.match(out.placement.reason, /municipality/)
    }
  })

  it('sends an address that names Madison, a state or a ZIP, or a unit', async () => {
    for (const text of [
      '7035 Littlemore Dr',
      '7035 Littlemore Dr, Madison',
      '7035 Littlemore Dr, Madison, WI 53718',
      '7035 Littlemore Dr, City of Madison, Wisconsin',
      '7035 Littlemore Dr, WI',
      '7035 Littlemore Dr, 53718',
      '7035 Littlemore Dr, Suite 2, Madison, WI',
      '7035 Littlemore Dr #3, Madison',
      '7035 Littlemore Dr.',
      '7035  LITTLEMORE   DR,  Madison',
    ]) {
      const { place, geocode } = setup()
      await place(nameOnly('unknown'), item(text))
      assert.equal(geocode.asked.length, 1, text)
    }
  })
})
