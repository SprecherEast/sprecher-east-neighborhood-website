import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pageWasRead, readReportPage } from '../lib/pageRead.mjs'
import { contract, fakeHttp } from './helpers.mjs'

// The runner's own read of a report page (#993): the fact the gate relies on. One request, no
// retry, no redirect, only the source's own https host, and only through robots.txt.

const source = contract.registry.sources.find((s) => s.id === 'madison-police-incident-reports')
const PAGE = 'https://www.cityofmadison.com/police/incident-reports/2026-11-19/armed-carjacking'
const read = (response, { robots = async () => true, ...own } = {}) => {
  const http = fakeHttp([response])
  const sourceUrl = 'sourceUrl' in own ? own.sourceUrl : PAGE
  return readReportPage({ sourceUrl }, { source, http, robots }).then((ok) => ({
    ok,
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
    const { ok, http } = await read(page)
    assert.equal(ok, true)
    assert.deepEqual(http.requested, [PAGE])
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
    assert.equal(await readReportPage({ sourceUrl: PAGE }, { source, http: down }), false)
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
      assert.equal(await readReportPage({ sourceUrl: PAGE }, { source: odd, http }), false)
    assert.deepEqual(http.requested, [])
  })

  it('reads the fact an item carries', () => {
    assert.equal(pageWasRead({}), false)
    assert.equal(pageWasRead(null), false)
  })

  it('does not follow a redirect, even to the same host', async () => {
    const http = fakeHttp([{ via: 'direct', status: 301, redirectTo: `${PAGE}/` }, page])
    assert.equal(await readReportPage({ sourceUrl: PAGE }, { source, http }), false)
    assert.deepEqual(http.requested, [PAGE])
  })

  it('asks nothing for a source with no address, even when the page has none either', async () => {
    const http = fakeHttp([page])
    const odd = { canonicalUrl: undefined }
    assert.equal(
      await readReportPage({ sourceUrl: 'http://example.com/x' }, { source: odd, http }),
      false,
    )
    assert.equal(await readReportPage({ sourceUrl: 'not a url' }, { source: odd, http }), false)
    assert.deepEqual(http.requested, [])
  })

  it('is not a read when reading the candidate itself throws', async () => {
    const candidate = {
      get sourceUrl() {
        throw new Error('no')
      },
    }
    assert.equal(await readReportPage(candidate, { source, http: fakeHttp([page]) }), false)
  })
})
