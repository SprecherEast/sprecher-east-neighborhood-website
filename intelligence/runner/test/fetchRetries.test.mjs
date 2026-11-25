import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MAX_BODY_BYTES, fetchDirect } from '../lib/fetchSource.mjs'
import { fakeHttp } from './helpers.mjs'

// What fetchDirect answers for each way a request can go wrong, exactly, and when it tries again
// (#1009): the answers the locator and the sources rely on.

const URL_ONE = 'https://a.example/find?q=1'
const ok = (body = 'ok') =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } })
const cut = () => ({
  status: 200,
  headers: new Headers(),
  text: async () => Promise.reject(new Error('cut')),
})
const answers = (...list) => {
  const asked = []
  const http = async () => {
    asked.push(1)
    const next = list.shift()
    if (next instanceof Error) throw next
    return typeof next === 'function' ? next() : next
  }
  return Object.assign(http, { asked })
}

describe('trying a second time, once', () => {
  it('asks again after no answer, and says so in the answer', async () => {
    const http = answers(new Error('reset'), ok())
    const out = await fetchDirect(URL_ONE, { http })
    assert.deepEqual([out.status, out.retries, out.body, http.asked.length], ['ok', 1, 'ok', 2])
    const failing = answers(new Error('reset'), new Error('reset'), ok())
    assert.deepEqual(await fetchDirect(URL_ONE, { http: failing }), {
      status: 'error',
      retries: 1,
      error: 'no answer: reset',
    })
    assert.equal(failing.asked.length, 2)
  })

  it('asks again after a body that did not come in, and says so in the answer', async () => {
    const http = answers(cut(), ok())
    const out = await fetchDirect(URL_ONE, { http })
    assert.deepEqual([out.status, out.retries, http.asked.length], ['ok', 1, 2])
    const failing = answers(cut(), cut(), ok())
    assert.deepEqual(await fetchDirect(URL_ONE, { http: failing }), {
      status: 'error',
      retries: 1,
      error: 'body not received: cut',
    })
    assert.equal(failing.asked.length, 2)
  })

  it('does not ask again when told not to, and says retries 0', async () => {
    for (const [first, error] of [
      [new Error('reset'), 'no answer: reset'],
      [cut(), 'body not received: cut'],
      [new Response('', { status: 503 }), '503'],
    ]) {
      const http = answers(first, ok())
      assert.deepEqual(await fetchDirect(URL_ONE, { http, retry: false }), {
        status: 'error',
        retries: 0,
        error,
      })
      assert.equal(http.asked.length, 1, error)
    }
  })
})

describe('the other ways an answer fails, exactly', () => {
  it('says the size that was too much, from what the server declares or what came', async () => {
    const declared = async () =>
      new Response('', { status: 200, headers: { 'content-length': '2000' } })
    assert.deepEqual(await fetchDirect(URL_ONE, { http: declared, maxBytes: 1000 }), {
      status: 'error',
      retries: 0,
      error: 'body over 1000 bytes',
    })
    const sent = (size) => async () => new Response('x'.repeat(size), { status: 200 })
    assert.equal((await fetchDirect(URL_ONE, { http: sent(1000), maxBytes: 1000 })).status, 'ok')
    assert.deepEqual(await fetchDirect(URL_ONE, { http: sent(1001), maxBytes: 1000 }), {
      status: 'error',
      retries: 0,
      error: 'body over 1000 bytes',
    })
  })

  it('says how many redirects it would not follow', async () => {
    const http = fakeHttp([{ status: 302, redirectTo: 'https://a.example/x' }])
    assert.deepEqual(await fetchDirect(URL_ONE, { http, maxHops: 0 }), {
      status: 'error',
      retries: 0,
      error: 'more than 0 redirects',
    })
  })

  it('keeps ten MiB as the default limit on a body', () => {
    assert.equal(MAX_BODY_BYTES, 10 * 1024 * 1024)
  })
})

describe('what it uses when given no stand-in', () => {
  it('asks with the global fetch, with or without options', async (t) => {
    const asked = []
    t.mock.method(globalThis, 'fetch', async (url) => (asked.push(String(url)), ok()))
    assert.equal((await fetchDirect(URL_ONE)).status, 'ok')
    assert.equal((await fetchDirect(URL_ONE, {})).status, 'ok')
    assert.equal(asked.length, 2)
  })
})
