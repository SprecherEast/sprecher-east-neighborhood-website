import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { pageWasRead, readReportPage } from '../lib/pageRead.mjs'
import { contract, fakeHttp } from './helpers.mjs'

// The runner's own read of a report page (#993): the fact the gate relies on. One request, no
// retry, no redirect, only the source's own https host, and only through robots.txt.

const source = contract.registry.sources.find((s) => s.id === 'madison-police-incident-reports')
const PAGE = 'https://www.cityofmadison.com/police/incident-reports/2026-11-19/armed-carjacking'
const read = (response, { robots = async () => true, ...own } = {}) => {
  const http = fakeHttp([response])
  const sourceUrl = 'sourceUrl' in own ? own.sourceUrl : PAGE
  return readReportPage({ sourceUrl }, { source, http, robots }).then((answer) => ({
    answer,
    ok: answer !== null,
    http,
  }))
}
const page = {
  via: 'direct',
  status: 200,
  contentType: 'text/html',
  body: '<h1>Armed Carjacking</h1>',
}

describe('reading a report page', () => {
  it('is a read when the page answers with a body', async () => {
    const { ok, answer, http } = await read(page)
    assert.equal(ok, true)
    assert.deepEqual(http.requested, [PAGE])
    // What goes to verify: the page's own address and its text, with the markup removed
    assert.deepEqual(answer, { url: PAGE, text: 'Armed Carjacking' })
  })

  it('is not a read for an error, an empty page, a redirect or a throw', async () => {
    for (const response of [
      { ...page, status: 404 },
      { ...page, status: 500 },
      { ...page, body: '' },
      { ...page, body: '   ' },
      { via: 'direct', status: 301, redirectTo: `${PAGE}/` },
    ])
      assert.equal((await read(response)).ok, false, JSON.stringify(response))
    const down = async () => {
      throw new Error('down')
    }
    assert.equal(await readReportPage({ sourceUrl: PAGE }, { source, http: down }), null)
  })

  it('makes one request, with no second try on an error', async () => {
    const { http } = await read({ ...page, status: 503 })
    assert.equal(http.requested.length, 1)
  })

  it('does not ask a page robots.txt disallows', async () => {
    const { ok, http } = await read(page, { robots: async () => false })
    assert.equal(ok, false)
    assert.deepEqual(http.requested, [])
  })

  it('reads only an https page on the source’s own host, and asks nothing else', async () => {
    for (const sourceUrl of [
      'http://www.cityofmadison.com/police/incident-reports/x',
      'https://example.com/police/incident-reports/x',
      'https://www.cityofmadison.com.example.com/x',
      // Another host that only ends the same way, and the same host on another port
      'https://cityofmadison.www.com/x',
      'https://www.cityofmadison.com:8443/police/incident-reports/x',
      'ftp://www.cityofmadison.com/x',
      'not a url',
      '',
      null,
      undefined,
    ]) {
      const { ok, http } = await read(page, { sourceUrl })
      assert.equal(ok, false, String(sourceUrl))
      assert.deepEqual(http.requested, [], String(sourceUrl))
    }
    // The host may be written with or without www, as the registry may
    const bare = await read(page, {
      sourceUrl: 'https://cityofmadison.com/police/incident-reports/x',
    })
    assert.equal(bare.ok, true)
  })

  it('is not a read for a source with no readable address', async () => {
    const http = fakeHttp([page])
    for (const odd of [undefined, {}, { canonicalUrl: 'nope' }])
      assert.equal(await readReportPage({ sourceUrl: PAGE }, { source: odd, http }), null)
    assert.deepEqual(http.requested, [])
  })

  it('counts a read only when the item carries the page text', () => {
    assert.equal(pageWasRead({}), false)
    assert.equal(pageWasRead(null), false)
    for (const reportPage of [null, {}, { url: PAGE }, { text: '' }, { text: '  ' }, { text: 7 }])
      assert.equal(pageWasRead({ reportPage }), false, JSON.stringify(reportPage))
    assert.equal(pageWasRead({ reportPage: { url: PAGE, text: 'Armed Carjacking' } }), true)
  })

  it('gives verify the page as plain, bounded text, never markup', async () => {
    const body = `<script>alert(1)</script><h1>Armed Carjacking</h1><p>7000 block of Littlemore Dr &amp; more</p><b>${'x'.repeat(9000)}</b>`
    const { answer } = await read({ ...page, body })
    assert.equal(answer.text.length, 8000)
    assert.match(answer.text, /^Armed Carjacking 7000 block of Littlemore Dr & more/)
    assert.equal(/[<>]|alert/.test(answer.text), false)
  })

  it('is not a read when the page has no text once the markup is gone', async () => {
    assert.equal((await read({ ...page, body: '<script>x()</script><div> </div>' })).ok, false)
  })

  it('compares the origin, so the same host on another scheme or port is another place', async () => {
    const bare = await read(page, { sourceUrl: 'https://cityofmadison.com:443/police/x' })
    assert.equal(bare.ok, true)
  })

  it('stops waiting for a page after ten seconds', async () => {
    const waits = []
    const real = AbortSignal.timeout.bind(AbortSignal)
    const spy = mock.method(AbortSignal, 'timeout', (ms) => {
      waits.push(ms)
      return real(ms)
    })
    try {
      const { ok } = await read(page)
      assert.equal(ok, true)
    } finally {
      spy.mock.restore()
    }
    assert.deepEqual(waits, [10_000])
    // A page that never answers within the bound is not a read
    const slow = async (_url, { signal }) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason)
        signal.addEventListener('abort', () => reject(signal.reason))
      })
    const aborted = mock.method(AbortSignal, 'timeout', () => AbortSignal.abort())
    try {
      assert.equal(await readReportPage({ sourceUrl: PAGE }, { source, http: slow }), null)
    } finally {
      aborted.mock.restore()
    }
  })

  it('reads a page up to one MiB and no further', async () => {
    const line = (size) => ({ ...page, body: 'a'.repeat(size) })
    assert.equal((await read(line(1024 * 1024))).ok, true)
    assert.equal((await read(line(1024 * 1024 + 1))).ok, false)
    assert.equal((await read(line(2048))).ok, true)
    // A page that says how long it is, and is over the bound, is not even read
    const declared = fakeHttp([{ ...page, body: 'a' }])
    const long = async (url, init) => {
      const response = await declared(url, init)
      return new Response(response.body, {
        status: 200,
        headers: { 'content-length': String(1024 * 1024 + 1) },
      })
    }
    assert.equal(await readReportPage({ sourceUrl: PAGE }, { source, http: long }), null)
  })

  it('does not follow a redirect, even to the same host', async () => {
    const http = fakeHttp([{ via: 'direct', status: 301, redirectTo: `${PAGE}/` }, page])
    assert.equal(await readReportPage({ sourceUrl: PAGE }, { source, http }), null)
    assert.deepEqual(http.requested, [PAGE])
  })

  it('asks nothing for a source with no address, even when the page has none either', async () => {
    const http = fakeHttp([page])
    const odd = { canonicalUrl: undefined }
    assert.equal(
      await readReportPage({ sourceUrl: 'http://example.com/x' }, { source: odd, http }),
      null,
    )
    assert.equal(await readReportPage({ sourceUrl: 'not a url' }, { source: odd, http }), null)
    assert.deepEqual(http.requested, [])
  })

  it('is not a read when reading the candidate itself throws', async () => {
    const candidate = {
      get sourceUrl() {
        throw new Error('no')
      },
    }
    assert.equal(await readReportPage(candidate, { source, http: fakeHttp([page]) }), null)
  })
})
