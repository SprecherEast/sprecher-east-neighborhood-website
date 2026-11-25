import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cityGeocoder, streetAddresses } from '../lib/geocode.mjs'
import { config } from './geocodeHelpers.mjs'

// The exact phrase for each way a locator request fails, what counts as a usable candidate, and
// the settings a request is made with (#1009). The phrases never hold the street or the URL.

const street = '7035 Littlemore Dr'
const reply =
  (status, headers = {}, body = '') =>
  async () =>
    new Response(status >= 300 && status < 400 ? null : body, { status, headers })
const geocode = (http) => cityGeocoder({ http, config })(street)
const candidate = (x, y, score = 100) => ({ score, location: { x, y } })

describe('how a failed request reads', () => {
  it('has one fixed phrase for each kind of failure', async () => {
    const cases = [
      [reply(403), 'the locator refused or sent us to a login'],
      [
        reply(307, { location: 'https://login.example/x' }),
        'the locator refused or sent us to a login',
      ],
      [reply(404), 'the locator answered HTTP 404'],
      [
        async () => {
          throw new Error('failed after 503')
        },
        'the locator could not be reached',
      ],
      [reply(302), 'the locator’s answer was refused'],
      [reply(503), 'the locator answered HTTP 503'],
      [
        reply(302, { location: 'https://maps.cityofmadison.com/x' }),
        'the locator’s answer was refused',
      ],
      [
        async () => {
          throw new Error('reset')
        },
        'the locator could not be reached',
      ],
      [
        async () => ({
          status: 200,
          ok: true,
          headers: new Headers(),
          body: null,
          text: async () => {
            throw new Error('cut')
          },
          arrayBuffer: async () => {
            throw new Error('cut')
          },
        }),
        'the locator could not be reached',
      ],
      [reply(200, { 'content-length': '999999' }, '{}'), 'the locator’s answer was too large'],
      [
        reply(200, {}, 'x'.repeat(config.maxKilobytes * 1024 + 1)),
        'the locator’s answer was too large',
      ],
      [reply(200, {}, 'nope'), 'the locator’s answer can’t be read'],
      [reply(200, {}, '{"error":{"code":400}}'), 'the locator’s answer can’t be read'],
    ]
    for (const [http, phrase] of cases)
      assert.deepEqual(await geocode(http), { status: 'failed', error: phrase })
  })

  it('refuses a street that is not plain, in its own words, without a request', async () => {
    const http = async () => assert.fail('asked')
    const out = await cityGeocoder({ http, config })(`1 ${'A'.repeat(100)} St`)
    assert.deepEqual(out, { status: 'failed', error: 'not a plain street address' })
  })

  it('takes an answer exactly at the size limit, and not one byte over', async () => {
    const body = (size) => `{"candidates":[]}${' '.repeat(size - 17)}`
    const limit = config.maxKilobytes * 1024
    assert.equal((await geocode(reply(200, {}, body(limit)))).status, 'none')
    assert.equal((await geocode(reply(200, {}, body(limit + 1)))).status, 'failed')
  })
})

describe('what a usable candidate is', () => {
  const answered = (...candidates) => reply(200, {}, JSON.stringify({ candidates }))
  const unusable = { status: 'failed', error: 'the locator’s answer can’t be read' }

  it('has a score and a point inside the range of a longitude and a latitude', async () => {
    for (const [x, y, usable] of [
      [180, 90, true],
      [-180, -90, true],
      [181, 43, false],
      [-181, 43, false],
      [-89, 91, false],
      [-89, -91, false],
    ]) {
      const out = await geocode(answered(candidate(x, y)))
      assert.deepEqual(out, usable ? { status: 'match', point: [x, y] } : unusable, `${x},${y}`)
    }
  })

  it('has numbers, not text that reads as numbers, and every part present', async () => {
    for (const bad of [
      { score: 100, location: { x: -89.25, y: '43.09' } },
      { score: 100, location: { x: '-89.25', y: 43.09 } },
      { score: '100', location: { x: -89.25, y: 43.09 } },
      { score: 100, location: { x: -89.25 } },
      { score: 100 },
      null,
    ])
      assert.deepEqual(await geocode(answered(bad)), unusable, JSON.stringify(bad))
  })
})

describe('when two strong matches are one place, east to west', () => {
  const metersPerDegree = 110_574
  const apart = (meters) => {
    const dx = meters / (metersPerDegree * Math.cos((43.09 * Math.PI) / 180))
    return reply(
      200,
      {},
      JSON.stringify({ candidates: [candidate(-89.25, 43.09), candidate(-89.25 + dx, 43.09)] }),
    )
  }

  it('measures a degree of longitude at the latitude of the points', async () => {
    const limit = config.sameSpotMeters
    assert.equal((await geocode(apart(limit * 0.999))).status, 'match')
    assert.equal((await geocode(apart(limit * 1.001))).status, 'ambiguous')
  })

  it('takes a distance of exactly the limit as one place', async () => {
    const dy = config.sameSpotMeters / metersPerDegree
    assert.equal(dy * metersPerDegree, config.sameSpotMeters)
    const answer = reply(
      200,
      {},
      JSON.stringify({ candidates: [candidate(-89.25, dy), candidate(-89.25, 0)] }),
    )
    assert.equal((await geocode(answer)).status, 'match')
  })
})

describe('the settings of a request', () => {
  it('waits the configured seconds and reads the configured kilobytes', async (t) => {
    const waits = []
    t.mock.method(AbortSignal, 'timeout', (ms) => (waits.push(ms), new AbortController().signal))
    await geocode(reply(200, {}, '{"candidates":[]}'))
    assert.deepEqual(waits, [config.timeoutSeconds * 1000])
  })

  it('uses the global fetch when no stand-in is given', async (t) => {
    const asked = []
    t.mock.method(
      globalThis,
      'fetch',
      async (url) => (asked.push(String(url)), new Response('{"candidates":[]}')),
    )
    assert.equal((await cityGeocoder({ config })(street)).status, 'none')
    assert.equal(asked.length, 1)
  })
})

describe('the same street written in another case', () => {
  it('is one address', () => {
    assert.deepEqual(streetAddresses('100 Main St and 100 MAIN ST'), ['100 Main St'])
  })
})
