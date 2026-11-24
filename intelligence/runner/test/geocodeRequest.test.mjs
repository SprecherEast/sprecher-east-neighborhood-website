import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cityGeocoder, isPlainStreet, streetAddresses } from '../lib/geocode.mjs'
import { createPlacer } from '../lib/place.mjs'
import { config } from './geocodeHelpers.mjs'
import { INSIDE, locatorAnswer } from './geoFixtures.mjs'
import { boundary, item, located, record } from './placeHelpers.mjs'

// What the request to the City's locator carries, and what a street word may hold (#1009;
// coverage.md, Review passes, check 2): the request forbids a redirect and a retry itself, because
// a stand-in never follows one, and the guard in front of the request refuses digits inside words.

const recording = (respond) => {
  const calls = []
  const http = async (url, init) => (calls.push({ url: String(url), init }), respond(calls.length))
  return Object.assign(http, { calls })
}
const answered = () =>
  new Response(JSON.stringify(JSON.parse(locatorAnswer(['7035 Littlemore Dr', INSIDE, 100]))))

describe('the request to the locator', () => {
  it('asks the HTTP function not to follow a redirect, with a time limit', async () => {
    const http = recording(answered)
    await cityGeocoder({ http, config })('7035 Littlemore Dr')
    assert.equal(http.calls.length, 1)
    assert.equal(http.calls[0].init.redirect, 'manual')
    assert.ok(http.calls[0].init.signal instanceof AbortSignal)
  })

  it('stops at a redirect answer after one GET, whatever the redirect says', async () => {
    const http = recording(
      () => new Response(null, { status: 302, headers: { location: `${config.source}/again` } }),
    )
    const result = await cityGeocoder({ http, config })('7035 Littlemore Dr')
    assert.equal(result.status, 'failed')
    assert.equal(http.calls.length, 1)
  })

  it('does not ask a second time after an error answer or a dropped connection', async () => {
    const error = recording(() => new Response('', { status: 500 }))
    assert.equal(
      (await cityGeocoder({ http: error, config })('7035 Littlemore Dr')).status,
      'failed',
    )
    assert.equal(error.calls.length, 1)
    const dropped = recording(() => {
      throw new Error('reset')
    })
    assert.equal(
      (await cityGeocoder({ http: dropped, config })('7035 Littlemore Dr')).status,
      'failed',
    )
    assert.equal(dropped.calls.length, 1)
  })
})

describe('a redirect that names no URL', () => {
  it('makes the locator throw after one GET, and the placer counts that as a failure', async () => {
    const http = recording(
      () => new Response(null, { status: 302, headers: { location: 'http://[bad' } }),
    )
    const geocode = cityGeocoder({ http, config })
    await assert.rejects(geocode('7035 Littlemore Dr'))
    assert.equal(http.calls.length, 1)
    const place = createPlacer({ boundary, record, geocode })
    const placed = await place(located('7035 Littlemore Dr'), item())
    assert.equal(http.calls.length, 2)
    assert.equal(placed.placement.method, 'word-match')
    assert.equal(placed.placement.reason, 'the locator failed')
  })
})

describe('what a street word may hold', () => {
  it('refuses digits inside or after the words, before any request', async () => {
    for (const street of [
      '7035 Littlemore Dr 5551234',
      '7035 Littlemore Dr 5',
      '7035 Little2more Dr',
      '7035 Littlemore Dr5',
    ]) {
      const http = recording(answered)
      assert.equal((await cityGeocoder({ http, config })(street)).status, 'failed', street)
      assert.equal(http.calls.length, 0, street)
      assert.equal(isPlainStreet(street), false, street)
    }
  })

  it('takes a period, an apostrophe and a hyphen inside words, and a lower-case street', async () => {
    for (const street of [
      '7035 St. Mary Dr',
      '7035 O’Brien Dr'.replace('’', "'"),
      '7035 Rolling-Hills Dr',
      '7035 littlemore dr',
      '7035 Mary. Dr',
    ]) {
      assert.equal(isPlainStreet(street), true, street)
      const http = recording(answered)
      assert.equal((await cityGeocoder({ http, config })(street)).status, 'match', street)
      assert.equal(http.calls.length, 1, street)
    }
  })

  it('finds a street with those characters in its words, as written', () => {
    assert.deepEqual(streetAddresses('At 7035 St. Mary Dr tonight'), ['7035 St. Mary Dr'])
    assert.deepEqual(streetAddresses("At 7035 O'Brien Dr tonight"), ["7035 O'Brien Dr"])
    assert.deepEqual(streetAddresses('At 7035 Rolling-Hills Dr tonight'), ['7035 Rolling-Hills Dr'])
  })
})
