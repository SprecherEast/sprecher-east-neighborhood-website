import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { item, located, setup } from './placeHelpers.mjs'

// The raise to core rests on what verify stated, and what is sent to the locator must be tied to
// Madison (#1009). Inputs are real-looking addresses, with the cases both sides of each rule.

describe('the raise to core rests on what verify confirmed', () => {
  const own = (address, over = {}) => {
    const v = located(address, { coverage: 'unknown', flags: [], ...over })
    v.location.municipality = over.municipality === undefined ? null : over.municipality
    return v
  }
  const unraised = (out) => !(out.coverage === 'core' && !out.flags.includes('ambiguous-location'))

  it('raises unknown only when verify’s own municipality is filled and is Madison', async () => {
    for (const [municipality, raised] of [
      ['Madison', true],
      ['City of Madison, WI 53718', true],
      [null, false],
      ['', false],
      ['  ', false],
    ]) {
      const { place } = setup()
      const out = await place(own('7035 Littlemore Dr', { municipality }), item())
      assert.equal(out.coverage, 'core')
      assert.equal(out.flags.includes('ambiguous-location'), !raised, String(municipality))
    }
  })

  it('gives no raise for an address that names another town, whatever verify left out', async () => {
    for (const address of [
      '7035 Littlemore Dr #2 Cottage Grove WI',
      '7035 Littlemore Dr, Suite 100 Cottage Grove WI 53527',
      '7035 Littlemore Dr, Apt 5 in Fitchburg',
      '7035 Littlemore Dr, Room 2 Sun Prairie',
      '7035 Littlemore Dr, 53527',
      '7035 Littlemore Dr, WI 53590',
      'Cottage Grove: 7035 Littlemore Dr',
      'In the Village of Cottage Grove at 7035 Littlemore Dr',
    ]) {
      const { place } = setup()
      const out = await place(own(address), item())
      assert.ok(unraised(out), address)
    }
  })

  it('does not send what names another town before the street, a long unit or another ZIP', async () => {
    for (const address of [
      '7035 Littlemore Dr #2 Cottage Grove WI',
      '7035 Littlemore Dr, Suite 100 Cottage Grove WI 53527',
      '7035 Littlemore Dr, Apt 5 in Fitchburg',
      '7035 Littlemore Dr, Room 2 Sun Prairie',
      '7035 Littlemore Dr, 53527',
      '7035 Littlemore Dr, WI 53590',
      'In the Village of Cottage Grove at 7035 Littlemore Dr',
      'Town of Blooming Grove, 7035 Littlemore Dr',
      'Town of Madison, 7035 Littlemore Dr',
      'City of Fitchburg, 7035 Littlemore Dr',
      'Village of Madison Heights, 7035 Littlemore Dr',
      'Fitchburg, WI 53711, 7035 Littlemore Dr',
      'Cottage Grove WI, 7035 Littlemore Dr',
      '53527, 7035 Littlemore Dr',
    ]) {
      const { place, geocode } = setup()
      const out = await place(own(address, { municipality: 'Madison' }), item())
      assert.deepEqual(geocode.asked, [], address)
      assert.equal(out.placement.method, 'word-match')
    }
  })

  it('still sends ordinary Madison addresses, with a venue before and a unit, ZIP or country after', async () => {
    for (const address of [
      '7035 Littlemore Dr',
      'City of Madison, 7035 Littlemore Dr',
      'Door Creek Park Shelter, 7035 Littlemore Dr, Madison, WI 53718',
      'Door Creek Park Shelter: 7035 Littlemore Dr, Madison',
      'Pinney Library meeting room, 100 Inside Edge Rd',
      '7035 Littlemore Dr, Unit 4B, Madison, WI 53718-1234',
      '7035 Littlemore Dr Apt #12, Madison',
      '7035 Littlemore Dr, Madison, WI 53718, USA',
      '7035 Littlemore Dr, Madison, Wisconsin, United States',
      '7035 Littlemore Dr, Madison, WI 53704',
      '7035 Littlemore Dr., Madison, WI 53718',
      '7035 Littlemore Dr, Madison, WI 53718.',
      'Door Creek Park, 7035 Littlemore Dr., Madison, WI 53718',
      '7035 Littlemore Dr, Madison, WI 53718, US',
    ]) {
      const { place, geocode } = setup()
      await place(own(address, { municipality: 'Madison' }), item())
      assert.equal(geocode.asked.length, 1, address)
    }
  })
})

describe('an address refused before it is sent', () => {
  it('is a reason, not a request or a locator failure', async () => {
    const long = `1 ${'A'.repeat(100)} St`
    const { place, geocode, problems } = setup()
    for (let i = 0; i < 3; i++) {
      const out = await place(located(long), item())
      assert.equal(out.placement.method, 'word-match')
      assert.match(out.placement.reason, /plain street/)
    }
    assert.deepEqual([geocode.asked, problems], [[], []])
    const next = await place(located('7035 Littlemore Dr'), item())
    assert.equal(next.placement.method, 'boundary')
  })
})

describe('the municipality verify gives', () => {
  it('is Madison with no other state or ZIP code, or nothing is sent', async () => {
    for (const [municipality, sent] of [
      ['Madison, WI 53718', true],
      ['Madison, WI 53527', false],
      ['Madison, WI 12345', false],
    ]) {
      const { place, geocode } = setup()
      const v = located('7035 Littlemore Dr')
      v.location.municipality = municipality
      await place(v, item())
      assert.equal(geocode.asked.length, sent ? 1 : 0, municipality)
    }
  })
})

describe('the stated limit of the text rule', () => {
  it('sends a town named plainly before the street, which a venue’s name cannot be told from, and never raises it on its own', async () => {
    for (const address of [
      'Cottage Grove: 7035 Littlemore Dr',
      'Fitchburg, 7035 Littlemore Dr',
      'In Cottage Grove at 7035 Littlemore Dr',
      'Monona Community Center, 1011 Nichols Rd',
    ]) {
      const { place, geocode } = setup()
      const v = located(address, { coverage: 'unknown', flags: [] })
      v.location.municipality = null
      const out = await place(v, item())
      assert.equal(geocode.asked.length, 1, address)
      assert.ok(!(out.coverage === 'core' && out.flags.length === 0), address)
    }
  })
})

describe('the raise needs verify’s address to begin with the street', () => {
  const madison = (address) => {
    const v = located(address, { coverage: 'unknown', flags: [] })
    v.location.municipality = 'Madison'
    return v
  }

  it('does not raise when a town or a venue is named before the street', async () => {
    for (const address of [
      'Cottage Grove: 7035 Littlemore Dr',
      'Fitchburg, 7035 Littlemore Dr',
      'Door Creek Park Shelter, 7035 Littlemore Dr, Madison, WI',
    ]) {
      const { place } = setup()
      const out = await place(madison(address), item())
      assert.deepEqual([out.coverage, out.flags], ['core', ['ambiguous-location']], address)
    }
  })

  it('raises when the street comes first, with the usual endings', async () => {
    for (const address of [
      '7035 Littlemore Dr',
      '  7035  Littlemore Dr, Madison, WI 53718',
      '7035 Littlemore Dr., Madison, WI 53718',
    ]) {
      const { place } = setup()
      const out = await place(madison(address), item())
      assert.deepEqual([out.coverage, out.flags], ['core', []], address)
    }
  })
})
