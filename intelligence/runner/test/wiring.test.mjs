import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runInputs } from '../lib/wiring.mjs'
import { INSIDE } from './geoFixtures.mjs'
import { contract } from './helpers.mjs'

// What the command hands the pipeline (#1009; run.mjs only calls this): the HTTP function, the
// robots.txt check on it, the City's locator with the settings from area.yaml, and the commit.

const settings = contract.area.boundary.geocoder
const answer = (score) =>
  new Response(
    JSON.stringify({ candidates: [{ score, location: { x: INSIDE[0], y: INSIDE[1] } }] }),
  )
const recording = (respond = () => answer(100)) => {
  const calls = []
  const http = async (url, init) => (calls.push({ url: String(url), init }), respond(String(url)))
  return Object.assign(http, { calls })
}
const inputs = (over = {}, http = recording()) =>
  runInputs({ contract: { ...contract, ...over }, http, commit: 'abc123' })

describe('what the command hands the pipeline', () => {
  it('hands on the contract, the HTTP function and the commit it was given', () => {
    const http = recording()
    const out = runInputs({ contract, http, commit: 'abc123' })
    assert.equal(out.contract, contract)
    assert.equal(out.http, http)
    assert.equal(out.repoCommit, 'abc123')
  })

  it('asks robots.txt of a host through the same HTTP function', async () => {
    const http = recording(() => new Response('User-agent: *\nDisallow: /private\n'))
    const { robots } = inputs({}, http)
    assert.equal(await robots('https://a.example/public'), true)
    assert.equal(await robots('https://a.example/private/x'), false)
    assert.deepEqual(
      http.calls.map((c) => c.url),
      ['https://a.example/robots.txt'],
    )
  })

  it('asks the City’s locator, through the same HTTP function, where area.yaml says', async () => {
    const http = recording()
    const out = await inputs({}, http).geocode('7035 Littlemore Dr')
    assert.deepEqual(out, { status: 'match', point: INSIDE })
    assert.equal(http.calls.length, 1)
    assert.ok(http.calls[0].url.startsWith(`${settings.source}/findAddressCandidates?`))
  })

  it('takes every setting from the contract: source, minimum score, same spot, timeout, size', async (t) => {
    const waits = []
    t.mock.method(AbortSignal, 'timeout', (ms) => (waits.push(ms), new AbortController().signal))
    const other = (change) => ({
      area: {
        ...contract.area,
        boundary: { ...contract.area.boundary, geocoder: { ...settings, ...change } },
      },
    })
    const source = 'https://other.example/locator'
    const http = recording()
    await inputs(other({ source }), http).geocode('7035 Littlemore Dr')
    assert.ok(http.calls[0].url.startsWith(`${source}/findAddressCandidates?`))
    const score = (min) =>
      inputs(
        other({ minScore: min }),
        recording(() => answer(60)),
      ).geocode('7035 Littlemore Dr')
    assert.equal((await score(60)).status, 'match')
    assert.equal((await score(61)).status, 'unsure')
    const two = (distance) => {
      const dy = distance / 110_574
      const body = {
        candidates: [
          { score: 100, location: { x: -89.25, y: 0 } },
          { score: 100, location: { x: -89.25, y: dy } },
        ],
      }
      return recording(() => new Response(JSON.stringify(body)))
    }
    assert.equal(
      (await inputs(other({ sameSpotMeters: 100 }), two(80)).geocode('7035 Littlemore Dr')).status,
      'match',
    )
    assert.equal(
      (await inputs(other({ sameSpotMeters: 70 }), two(80)).geocode('7035 Littlemore Dr')).status,
      'ambiguous',
    )
    waits.length = 0
    await inputs(other({ timeoutSeconds: 7 })).geocode('7035 Littlemore Dr')
    assert.deepEqual(waits, [7000])
    const big = () => new Response(`{"candidates":[]}${' '.repeat(2048)}`)
    assert.equal(
      (await inputs(other({ maxKilobytes: 1 }), recording(big)).geocode('7035 Littlemore Dr'))
        .status,
      'failed',
    )
    assert.equal(
      (await inputs(other({ maxKilobytes: 3 }), recording(big)).geocode('7035 Littlemore Dr'))
        .status,
      'none',
    )
  })
})
