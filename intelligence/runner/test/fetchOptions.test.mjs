import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { MAX_BODY_BYTES, TIMEOUT_MS, fetchDirect } from '../lib/fetchSource.mjs'
import { fakeHttp } from './helpers.mjs'

// The options a small API call uses to tighten fetchDirect (#1009); the defaults are what the
// sources rely on, so they are checked too.

const URL_ONE = 'https://a.example/find?q=1'

describe('fetchDirect options', () => {
  it('retries a server error once by default', async () => {
    const http = fakeHttp([{ status: 503 }, { status: 200, body: 'ok' }])
    const answer = await fetchDirect(URL_ONE, { http })
    assert.equal(answer.status, 'ok')
    assert.equal(http.requested.length, 2)
  })

  it('does not retry when told not to, on a server error, a 429 or no answer', async () => {
    for (const first of [{ status: 503 }, { status: 429 }]) {
      const http = fakeHttp([first, { status: 200, body: 'ok' }])
      const answer = await fetchDirect(URL_ONE, { http, retry: false })
      assert.equal(answer.status, 'error')
      assert.equal(http.requested.length, 1)
    }
    let calls = 0
    const down = async () => {
      calls++
      throw new Error('reset')
    }
    assert.equal((await fetchDirect(URL_ONE, { http: down, retry: false })).status, 'error')
    assert.equal(calls, 1)
    const cut = async () => {
      calls++
      return {
        status: 200,
        headers: new Headers(),
        text: async () => Promise.reject(new Error('cut')),
      }
    }
    calls = 0
    assert.equal((await fetchDirect(URL_ONE, { http: cut, retry: false })).status, 'error')
    assert.equal(calls, 1)
  })

  it('names the plain status when it does not retry, and says it retried when it did', async () => {
    const once = fakeHttp([{ status: 503 }])
    assert.equal((await fetchDirect(URL_ONE, { http: once, retry: false })).error, '503')
    const twice = fakeHttp([{ status: 503 }, { status: 503 }])
    assert.equal((await fetchDirect(URL_ONE, { http: twice })).error, '503 after one retry')
  })

  it('keeps the defaults the sources rely on: 30 s to answer, 10 MiB of body', async () => {
    const timeout = mock.method(AbortSignal, 'timeout')
    try {
      await fetchDirect(URL_ONE, { http: fakeHttp([{ status: 200, body: 'ok' }]) })
      await fetchDirect(URL_ONE, { http: fakeHttp([{ status: 200, body: 'ok' }]), timeoutMs: 5 })
      assert.deepEqual(
        timeout.mock.calls.map((c) => c.arguments[0]),
        [TIMEOUT_MS, 5],
      )
    } finally {
      timeout.mock.restore()
    }
    assert.equal(TIMEOUT_MS, 30_000)
    const declared = (bytes) => async () =>
      new Response('', { status: 200, headers: { 'content-length': String(bytes) } })
    assert.equal((await fetchDirect(URL_ONE, { http: declared(MAX_BODY_BYTES) })).status, 'ok')
    assert.equal(
      (await fetchDirect(URL_ONE, { http: declared(MAX_BODY_BYTES + 1) })).status,
      'error',
    )
    assert.equal(
      (await fetchDirect(URL_ONE, { http: declared(2000), maxBytes: 1000 })).status,
      'error',
    )
  })

  it('follows redirects by default, up to three, and none when told maxHops 0', async () => {
    const hop = (to) => ({ status: 302, redirectTo: to })
    const free = fakeHttp([hop('https://b.example/find?q=1'), { status: 200, body: 'ok' }])
    assert.equal((await fetchDirect(URL_ONE, { http: free })).status, 'ok')
    for (const to of [
      'https://b.example/find?q=1',
      'https://a.example/other',
      'https://a.example:8443/find?q=1',
    ]) {
      const kept = fakeHttp([hop(to), { status: 200, body: 'ok' }])
      const answer = await fetchDirect(URL_ONE, { http: kept, maxHops: 0 })
      assert.equal(answer.status, 'error', to)
      assert.equal(kept.requested.length, 1, to)
    }
    const loop = fakeHttp(Array.from({ length: 6 }, () => hop('https://a.example/again')))
    assert.equal((await fetchDirect(URL_ONE, { http: loop })).status, 'error')
    assert.equal(loop.requested.length, 4)
    const none = await fetchDirect(URL_ONE, {
      http: fakeHttp([hop('https://a.example/x')]),
      maxHops: 0,
    })
    assert.match(none.error, /more than 0 redirects/)
  })
})
