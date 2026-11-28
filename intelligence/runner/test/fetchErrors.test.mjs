import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { fetchDirect } from '../lib/fetchSource.mjs'

// What a failed request says, and which refusal comes first when two apply (#1009: the locator
// reads these answers, and a redirect is a failure whichever way it goes).

const redirect = (location) => async () =>
  new Response(null, { status: 302, headers: location ? { location } : {} })

describe('a redirect that cannot be followed', () => {
  it('without a location is an error that says so, after one request', async () => {
    let asked = 0
    const http = async () => (asked++, new Response(null, { status: 302 }))
    const result = await fetchDirect('https://a.example/x', { http, retry: false, maxHops: 0 })
    assert.deepEqual(result, { status: 'error', retries: 0, error: '302 without a location' })
    assert.equal(asked, 1)
  })

  it('to a login page is blocked even when it also leaves https', async () => {
    const result = await fetchDirect('https://a.example/x', {
      http: redirect('http://a.example/login'),
      retry: false,
    })
    assert.equal(result.status, 'blocked')
    assert.match(result.error, /^redirect to a gate: /)
  })

  it('from https to plain http is an error', async () => {
    const result = await fetchDirect('https://a.example/x', {
      http: redirect('http://a.example/feed'),
      retry: false,
    })
    assert.equal(result.status, 'error')
    assert.match(result.error, /^redirect from https to /)
  })
})

describe('a request that throws', () => {
  it('says what was thrown, an Error’s message or the value itself', async () => {
    for (const [thrown, said] of [
      [new Error('reset'), 'no answer: reset'],
      ['plain text', 'no answer: plain text'],
    ]) {
      const http = async () => {
        throw thrown
      }
      assert.deepEqual(await fetchDirect('https://a.example/x', { http, retry: false }), {
        status: 'error',
        retries: 0,
        error: said,
      })
    }
  })

  it('says what was thrown while the body came in', async () => {
    const http = async () => ({
      status: 200,
      headers: new Headers(),
      text: async () => {
        throw 'cut off'
      },
    })
    const result = await fetchDirect('https://a.example/x', { http, retry: false })
    assert.equal(result.error, 'body not received: cut off')
  })
})
