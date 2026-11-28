import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dryRunCms } from '../lib/cms.mjs'
import { fetchDirect } from '../lib/fetchSource.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { scoutSource } from '../lib/scout.mjs'
import { accepting, FEEDS, feedsHttp } from './fixtures.mjs'
import { atNoon, budgets, contract } from './helpers.mjs'

// Regressions from the re-check of #369.

describe('fixes from the re-check', () => {
  it('refuses a redirect from https to plain http even when it would answer', async () => {
    const queue = [
      [301, 'http://a.example/feed'],
      [200, null],
    ]
    const http = async () => {
      const [status, location] = queue.shift()
      return new Response(status === 200 ? 'ok' : null, {
        status,
        headers: location ? { location } : {},
      })
    }
    const result = await fetchDirect('https://a.example/feed', { http })
    assert.equal(result.status, 'error')
    assert.match(result.error, /https to http:/)
  })

  it('reports an invalid candidate once, then leaves it alone', async () => {
    const broken = FEEDS['legistar-events'].replace(
      '"COMMON COUNCIL"',
      `"COMMON COUNCIL ${'x'.repeat(400)}"`,
    )
    const feeds = { ...FEEDS, 'legistar-events': broken }
    const state = { sources: {}, seen: {} }
    const go = async () => {
      const cms = dryRunCms(null)
      cms.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
      await runPipeline({
        contract,
        cms,
        ask: accepting,
        state,
        http: feedsHttp(feeds),
        robots: async () => true,
        repoCommit: 'a'.repeat(40),
      })
      return cms.writes.filter(
        (w) => w.tool === 'reportItem' && w.arguments.kind === 'rejected-invalid',
      )
    }
    assert.equal((await go()).length, 1)
    state.sources = {}
    assert.equal((await go()).length, 0)
  })

  it('does not count unchanged items against the per-source cap', async () => {
    const library = contract.registry.sources.find((s) => s.id === 'mpl-pinney-events')
    const ics = FEEDS['mpl-pinney-events'].replace(
      'END:VEVENT',
      'RRULE:FREQ=DAILY;COUNT=4\r\nEND:VEVENT',
    )
    const options = {
      budgets: { ...budgets, maxItemsPerSource: 2 },
      validate: contract.validator('schemas/candidate.schema.json'),
      lookAheadDays: contract.pipeline.lookAheadDays,
      now: atNoon('2026-10-25'),
    }
    const first = await scoutSource(library, {
      area: contract.area,
      ...options,
      state: { sources: {}, seen: {} },
      http: async () => new Response(ics),
    })
    const seen = Object.fromEntries(
      first.candidates.map((c) => [
        c.externalId,
        { hash: c.contentHash, at: '2026-10-25T00:00:00Z' },
      ]),
    )
    const second = await scoutSource(library, {
      area: contract.area,
      ...options,
      state: { sources: {}, seen },
      http: async () => new Response(ics),
    })
    assert.deepEqual(
      second.candidates.map((c) => c.change),
      ['unchanged', 'unchanged', 'new', 'new'],
    )
    assert.equal(second.deferred, 0)
  })
})

describe('follow-up reports that fail', () => {
  it('are kept in the state and sent at the start of the next run', async () => {
    const state = { sources: {}, seen: {} }
    const down = dryRunCms(null)
    down.taxonomy = async () => [{ slug: 'community', title: 'Community', parent: null }]
    down.reportItem = async () => {
      throw new Error('fetch failed: 503')
    }
    await runPipeline({
      contract,
      cms: down,
      ask: accepting,
      state,
      http: feedsHttp(),
      robots: async () => true,
      now: () => atNoon('2026-11-16'),
      repoCommit: 'a'.repeat(40),
    })
    assert.equal(state.pendingReports.length, 1)
    assert.deepEqual(state.pendingReports[0].flags, ['image-candidate'])

    const up = dryRunCms(null)
    up.taxonomy = down.taxonomy
    const { log } = await runPipeline({
      contract,
      cms: up,
      ask: accepting,
      state,
      http: feedsHttp(),
      robots: async () => true,
      now: () => atNoon('2026-11-16'),
      repoCommit: 'a'.repeat(40),
    })
    const sent = up.writes.filter((w) => w.tool === 'reportItem')
    assert.equal(sent.length, 1)
    assert.equal(sent[0].arguments.runId, log.runId)
    assert.deepEqual(state.pendingReports, [])
  })
})
