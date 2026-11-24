import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cityGeocoder, streetAddresses } from '../lib/geocode.mjs'
import { contract, fakeHttp } from './helpers.mjs'
import { INSIDE, JUST_OUTSIDE, LOCATOR, locatorAnswer } from './geoFixtures.mjs'

// From an item's text to a street address, and from that to a point (#1009). The City's own
// locator is the only geocoder; only the street address is ever sent. No test calls the network.

const config = contract.area.boundary.geocoder
const json = (body) => ({ status: 200, contentType: 'application/json', body })
const ask = async (street, ...answers) => {
  const http = fakeHttp(answers)
  const result = await cityGeocoder({ http, config })(street)
  return { result, http }
}

describe('the street address in a text', () => {
  const cases = {
    '7035 Littlemore Dr, Madison, WI 53718': ['7035 Littlemore Dr'],
    'Pinney Library, 516 Cottage Grove Road': ['516 Cottage Grove Road'],
    '100 Inside Edge Rd #3, Madison': ['100 Inside Edge Rd'],
    '201 S Sprecher Rd': ['201 S Sprecher Rd'],
    '1 West Main Street': ['1 West Main Street'],
    'Sprecher Rd and Milwaukee St': [],
    'Room 12 at the community center': [],
    'Meet at 7 PM on Main St': [],
    '100 Main St and 200 State St': ['100 Main St', '200 State St'],
    '100 Main St, again at 100 main st': ['100 Main St'],
    '': [],
  }
  for (const [text, expected] of Object.entries(cases)) {
    it(`reads ${JSON.stringify(text)}`, () => assert.deepEqual(streetAddresses(text), expected))
  }

  it('reads nothing from a missing text', () => {
    assert.deepEqual(streetAddresses(null), [])
    assert.deepEqual(streetAddresses(undefined), [])
  })

  it('never answers more than the number, the street and its type', () => {
    for (const found of streetAddresses('Call Jo Smith at 555 1234 about 4 Elm St, apt 2, 53703')) {
      assert.match(found, /^\d+ [A-Za-z ]+$/)
    }
  })
})

describe('the City’s locator', () => {
  it('answers the point of an address it matches, asking for the street address alone', async () => {
    const { result, http } = await ask('7035 Littlemore Dr', json(LOCATOR['7035 Littlemore Dr']))
    assert.deepEqual(result, { status: 'match', point: INSIDE })
    assert.deepEqual(http.requested, [
      `${config.source}/findAddressCandidates?SingleLine=7035+Littlemore+Dr&outSR=4326&maxLocations=5&f=json`,
    ])
  })

  it('says none when the locator finds nothing', async () => {
    const { result } = await ask('4801 Sprecher Rd', json(locatorAnswer()))
    assert.deepEqual(result, { status: 'none' })
  })

  it('says unsure when the best match scores under the minimum', async () => {
    const weak = locatorAnswer(['7035 Littlemore, Madison', INSIDE, config.minScore - 1])
    assert.deepEqual((await ask('7035 Littlemore Dr', json(weak))).result, { status: 'unsure' })
  })

  it('takes a match at the minimum score', async () => {
    const edge = locatorAnswer(['7035 Littlemore Dr', INSIDE, config.minScore])
    assert.equal((await ask('7035 Littlemore Dr', json(edge))).result.status, 'match')
  })

  it('says ambiguous when strong matches are in different places', async () => {
    const two = locatorAnswer(
      ['100 Main St, Madison', INSIDE, 100],
      ['100 Main St, Madison', JUST_OUTSIDE, 100],
    )
    assert.deepEqual((await ask('100 Main St', json(two))).result, { status: 'ambiguous' })
  })

  it('treats strong matches on the same spot, such as units of one building, as one', async () => {
    const [x, y] = INSIDE
    const units = locatorAnswer(
      ['1 Elm St Unit 1', INSIDE, 100],
      ['1 Elm St Unit 2', [x + 0.00005, y], 100],
    )
    assert.equal((await ask('1 Elm St', json(units))).result.status, 'match')
  })

  it('ignores a weak match beside a strong one', async () => {
    const mixed = locatorAnswer(['100 Main St', INSIDE, 100], ['100 Main Ave', JUST_OUTSIDE, 60])
    assert.deepEqual((await ask('100 Main St', json(mixed))).result, {
      status: 'match',
      point: INSIDE,
    })
  })

  const failures = {
    'a server error twice': [{ status: 500 }, { status: 500 }],
    'a refusal': [{ status: 403 }],
    'an answer that isn’t JSON': [json('<html>maintenance</html>')],
    'an error inside a 200': [json(JSON.stringify({ error: { code: 400, message: 'bad' } }))],
    'an answer without candidates': [json('{}')],
    'a candidate without a point': [json('{"candidates":[{"address":"x","score":100}]}')],
    'a point that isn’t numbers': [
      json('{"candidates":[{"score":100,"location":{"x":"a","y":"b"}}]}'),
    ],
    'a point off the map': [json(locatorAnswer(['x', [300, 99], 100]))],
    'a score that isn’t a number': [
      json('{"candidates":[{"score":"high","location":{"x":-89,"y":43}}]}'),
    ],
  }
  for (const [name, answers] of Object.entries(failures)) {
    it(`fails safely on ${name}`, async () => {
      const { result } = await ask('7035 Littlemore Dr', ...answers)
      assert.equal(result.status, 'failed')
      assert.equal(typeof result.error, 'string')
      assert.ok(result.error.length <= 300)
    })
  }

  it('fails safely when the network is down', async () => {
    const down = async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }
    const result = await cityGeocoder({ http: down, config })('7035 Littlemore Dr')
    assert.equal(result.status, 'failed')
  })

  it('gives up on an answer that takes longer than the timeout', async () => {
    // The timeout's own timer doesn't keep the process alive, as a real open connection would
    const hang = (url, { signal }) =>
      new Promise((resolve, reject) => {
        const open = setTimeout(resolve, 5000)
        signal.addEventListener('abort', () => {
          clearTimeout(open)
          reject(new Error('timed out'))
        })
      })
    const quick = { ...config, timeoutSeconds: 0.02 }
    const result = await cityGeocoder({ http: hang, config: quick })('7035 Littlemore Dr')
    assert.equal(result.status, 'failed')
  })

  it('refuses an answer over the size limit', async () => {
    const big = json(locatorAnswer(['x'.repeat(config.maxKilobytes * 1024), INSIDE, 100]))
    assert.equal((await ask('7035 Littlemore Dr', big)).result.status, 'failed')
  })

  it('never sends a street that isn’t a short plain street address', async () => {
    for (const street of ['', ' ', 'x'.repeat(200), '1 Main St&token=abc', '1 Main St\n2 Elm']) {
      const http = fakeHttp([])
      const result = await cityGeocoder({ http, config })(street)
      assert.equal(result.status, 'failed')
      assert.deepEqual(http.requested, [])
    }
  })
})
