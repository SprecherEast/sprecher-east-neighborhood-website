import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cityGeocoder } from '../lib/geocode.mjs'
import { fakeHttp } from './helpers.mjs'
import { ask, config, json } from './geocodeHelpers.mjs'
import { INSIDE, LOCATOR, locatorAnswer } from './geoFixtures.mjs'

// What the City's locator is sent, and how each failure reads (#1009): one plain street address,
// one GET to the City's host, no retry, and a failure phrase that never holds the street.

describe('what the City’s locator is sent and how it fails', () => {
  it('never sends a value that isn’t a string, even one that prints like a street', async () => {
    for (const street of [['7035 Littlemore Dr'], { toString: () => '7035 Littlemore Dr' }, 7035]) {
      const http = fakeHttp([])
      assert.equal((await cityGeocoder({ http, config })(street)).status, 'failed')
      assert.deepEqual(http.requested, [])
    }
  })

  it('says in a fixed phrase why a request failed, whatever the cause', async () => {
    const cases = [
      [{ status: 403 }, /refused or sent us to a login/],
      [{ status: 500 }, /answered HTTP 500/],
      [
        { status: 200, headers: { 'content-length': String(config.maxKilobytes * 1024 + 1) } },
        /too large/,
      ],
    ]
    for (const [answer, phrase] of cases) {
      const http = async () =>
        new Response('', { status: answer.status, headers: answer.headers ?? {} })
      const result = await cityGeocoder({ http, config })('7035 Littlemore Dr')
      assert.match(result.error, phrase)
    }
    const down = async () => {
      throw new Error('reset')
    }
    const slow = await cityGeocoder({ http: down, config })('7035 Littlemore Dr')
    assert.match(slow.error, /could not be reached/)
  })

  it('fails when the answer holds an error beside candidates', async () => {
    const both = JSON.stringify({
      ...JSON.parse(LOCATOR['7035 Littlemore Dr']),
      error: { code: 500 },
    })
    assert.equal((await ask('7035 Littlemore Dr', json(both))).result.status, 'failed')
  })

  it('refuses a point whose coordinates are numbers in quotes', async () => {
    const quoted = '{"candidates":[{"score":100,"location":{"x":"-89.25","y":"43.09"}}]}'
    assert.equal((await ask('7035 Littlemore Dr', json(quoted))).result.status, 'failed')
  })

  it('takes the best score, wherever it is in the list, and measures from it', async () => {
    const near = [INSIDE[0] + 0.0003, INSIDE[1]]
    const answer = locatorAnswer(['a', near, 91], ['b', INSIDE, 100])
    const { result } = await ask('7035 Littlemore Dr', json(answer))
    assert.deepEqual(result, { status: 'match', point: INSIDE })
  })

  it('counts two strong matches 25 m apart east to west as one spot, as the ground is measured', async () => {
    const near = [INSIDE[0] + 0.0003, INSIDE[1]]
    const { result } = await ask(
      '7035 Littlemore Dr',
      json(locatorAnswer(['a', INSIDE, 100], ['b', near, 100])),
    )
    assert.equal(result.status, 'match')
  })

  it('never sends a street that isn’t a short plain street address', async () => {
    const longName = `1 ${'A'.repeat(100)} St`
    for (const street of [
      '',
      ' ',
      'x'.repeat(200),
      longName,
      '1 Main St&token=abc',
      '1 Main St\n2 Elm',
    ]) {
      const http = fakeHttp([])
      const result = await cityGeocoder({ http, config })(street)
      assert.equal(result.status, 'failed')
      assert.deepEqual(http.requested, [])
    }
  })

  it('keeps the street out of the error when an answer can’t be read, whatever it echoes', async () => {
    for (const body of [
      '<html>No match for 7035 Littlemore Dr</html>',
      '{"candidates":[{"address":"7035 Littlemore Dr"}]} trailing',
      JSON.stringify({ error: { message: 'bad 7035 Littlemore Dr' } }),
    ]) {
      const { result } = await ask('7035 Littlemore Dr', json(body))
      assert.equal(result.status, 'failed')
      assert.doesNotMatch(result.error, /Littlemore/)
      assert.equal(result.error, 'the locator’s answer can’t be read')
    }
  })

  describe('the request is one GET to the City’s own host', () => {
    const asked = async (...answers) => {
      const http = fakeHttp(answers)
      const result = await cityGeocoder({ http, config })('7035 Littlemore Dr')
      return { result, http }
    }

    it('is not retried after a server error, a refusal to answer or a network error', async () => {
      const { result, http } = await asked({ status: 503 }, json(LOCATOR['7035 Littlemore Dr']))
      assert.equal(result.status, 'failed')
      assert.equal(http.requested.length, 1)
      let calls = 0
      const down = async () => {
        calls++
        throw new Error('reset')
      }
      await cityGeocoder({ http: down, config })('7035 Littlemore Dr')
      assert.equal(calls, 1)
    })

    it('is not retried after a 429 that asks for a wait', async () => {
      const { result, http } = await asked({ status: 429 }, json(LOCATOR['7035 Littlemore Dr']))
      assert.equal(result.status, 'failed')
      assert.equal(http.requested.length, 1)
    })

    it('never follows a redirect, so one address is one GET and the street goes nowhere else', async () => {
      const origin = new URL(config.source).origin
      for (const to of [
        'https://other.example/find',
        `${origin}/elsewhere/findAddressCandidates`,
        origin.replace('.com', '.com:8443') + '/find',
        '//other.example/find',
      ]) {
        const { result, http } = await asked(
          { status: 302, redirectTo: to },
          json(LOCATOR['7035 Littlemore Dr']),
        )
        assert.equal(result.status, 'failed', to)
        assert.equal(http.requested.length, 1, to)
      }
    })

    it('keeps the street and any URL out of the error it reports', async () => {
      const gate = `${new URL(config.source).origin}/login?SingleLine=7035+Littlemore+Dr`
      for (const answer of [
        { status: 302, redirectTo: gate },
        { status: 302, redirectTo: 'https://other.example/7035+Littlemore+Dr' },
        { status: 302, redirectTo: 'http://maps.cityofmadison.com/7035+Littlemore+Dr' },
      ]) {
        const { result } = await asked(answer)
        assert.equal(result.status, 'failed')
        assert.doesNotMatch(result.error, /Littlemore|https?:/i)
      }
    })
  })
})
