import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pilotSources } from '../lib/contract.mjs'
import {
  areaMatcher,
  keepItem,
  mergeAcrossSources,
  mergedCopies,
  scoutSource,
  sourceUrl,
} from '../lib/scout.mjs'
import { atNoon, budgets, contract, evalCases, fakeHttp, grade } from './helpers.mjs'

// The scout evals (evals/scout.yaml) as unit tests: scout is code, so each case's fetch answers go
// through the real fetch, parse and normalize steps.

const NOT_BUILT = {
  'fetch-fallback': 'the Playwright fallback is not built yet (#364)',
  duplicate:
    'a blog post is news with no start of its own: matching it to a meeting is verify’s job (#390)',
}

const { cases, asOf } = evalCases('scout')
const freshState = () => ({ sources: {}, seen: {} })
const validate = contract.validator('schemas/candidate.schema.json')

describe('scout evals', () => {
  for (const c of cases) {
    const skip = c.tags?.map((t) => NOT_BUILT[t]).find(Boolean)
    it(`${c.id}: ${c.why.slice(0, 80)}`, { skip }, async () => {
      const registered = contract.registry.sources.find((s) => s.id === c.input.sourceId)
      const override = c.given?.sources?.find((s) => s.id === c.input.sourceId) ?? {}
      const source = { ...registered, ...override }
      const polled = source.result === 'valid' && Number.isInteger(source.pilotRank)
      // A source that isn't valid with a rank never reaches the fetch, by pilotSources
      const pilots = pilotSources({ sources: [source] })
      assert.equal(pilots.length, polled ? 1 : 0)
      const http = fakeHttp(c.input.responses)
      const result = polled
        ? await scoutSource(source, {
            area: contract.area,
            state: freshState(),
            http,
            budgets,
            validate,
            now: atNoon(asOf),
          })
        : { check: { fetchStrategy: 'none', status: 'skipped' }, candidates: [], invalid: [] }

      assert.equal(result.check.fetchStrategy, c.expected.fetchStrategy)
      assert.equal(result.check.status, c.expected.runStatus)
      assert.deepEqual(result.invalid, [])
      if (c.expected.candidateCount !== undefined) {
        assert.equal(result.candidates.length, c.expected.candidateCount)
      }
      if (c.expected.retries !== undefined) {
        assert.equal(http.requested.length - 1, c.expected.retries)
      }
      for (const grader of c.graders ?? []) {
        const verdict = grade(grader, result.candidates[0])
        if (verdict !== null) assert.ok(verdict, `${grader.check} ${grader.field}`)
      }
      if (c.id === 'scout-recurring-one-cancelled') {
        const statuses = result.candidates.map((x) => [x.startsAt.slice(0, 10), x.sourceStatus])
        assert.deepEqual(statuses, [
          ['2026-11-03', 'scheduled'],
          ['2026-11-10', 'cancelled'],
          ['2026-11-17', 'scheduled'],
        ])
        assert.equal(new Set(result.candidates.map((x) => x.externalId)).size, 3)
      }
    })
  }
})

describe('scout', () => {
  it('reads only valid pilot sources, in rank order', () => {
    const ids = pilotSources(contract.registry).map((s) => s.id)
    assert.deepEqual(ids, [
      'legistar-events',
      'mpl-pinney-events',
      'legistar-matters',
      'madison365-news',
      'wisdot-i39-90-94',
      'city-public-info-meetings',
      'district16-blog',
      'city-news',
    ])
  })

  it('fills the date window and the cursor', () => {
    const [events, , matters] = pilotSources(contract.registry)
    const url = sourceUrl(events, { today: '2026-10-25' })
    assert.match(url, /datetime'2026-10-25'.*datetime'2026-11-08'/)
    assert.match(sourceUrl(matters, { today: '2026-10-25' }), /datetime'2026-10-18T00:00:00'/)
    assert.match(
      sourceUrl(matters, { today: '2026-10-25', cursor: '2026-10-24T12:00:00' }),
      /2026-10-24T12:00:00/,
    )
  })

  it('keeps Legistar items only for the council, hearings or a place in the area', () => {
    const events = { id: 'legistar-events' }
    const namesArea = areaMatcher(contract.area)
    const item = (title, text = '') => ({ title, sourceText: text, locationText: null })
    assert.ok(keepItem(events, item('COMMON COUNCIL'), namesArea))
    assert.ok(
      keepItem(events, item('PLAN COMMISSION', 'Public hearing on 4802 Sprecher Rd'), namesArea),
    )
    assert.ok(!keepItem(events, item('TRANSPORTATION COMMISSION', 'Budget review'), namesArea))
    assert.ok(!keepItem({ id: 'legistar-matters' }, item('Citywide fee schedule'), namesArea))
  })

  it('names the area from area.yaml: places, neighbors, and I-94 only with a cross street (#390)', () => {
    const namesArea = areaMatcher(contract.area)
    assert.ok(namesArea('Resurfacing on Cottage Grove Rd'))
    assert.ok(namesArea('North Star neighborhood association picnic'))
    assert.ok(namesArea('Richmond Hill homeowners meeting'))
    // East Towne's High Crossing Blvd is outside (coverage.md)
    assert.ok(!namesArea('High Crossing Blvd sidewalk hearing'))
    assert.ok(namesArea('I-39/90/94 at Milwaukee St: open house'))
    assert.ok(namesArea('Milwaukee Street intersection with Highway 94'))
    assert.ok(!namesArea('Highway 94 resurfacing'))
    // A highway alone names half the city
    assert.ok(!namesArea('I-94 lane closures overnight'))
    assert.ok(!namesArea('Milwaukee Street reconstruction near Fair Oaks'))
    assert.ok(namesArea('Milwaukee Street and I-94: proposed interchange'))
    assert.ok(namesArea('Interstate 94 interchange study, public meeting'))
    // Whole words only
    assert.ok(!namesArea('Pinneyville Road'))
  })

  it('skips an item it already handled, and marks a changed one as updated', async () => {
    const body =
      '[{"EventId":1,"EventBodyName":"COMMON COUNCIL","EventDate":"2026-11-03T00:00:00","EventTime":"6:30 PM","EventLocation":"Virtual"}]'
    const source = pilotSources(contract.registry)[0]
    const options = { budgets, validate, now: atNoon('2026-10-25') }
    const first = await scoutSource(source, {
      area: contract.area,
      ...options,
      state: freshState(),
      http: fakeHttp([{ status: 200, body }]),
    })
    const [candidate] = first.candidates
    const seen = { sources: {}, seen: { [candidate.externalId]: candidate.contentHash } }
    const again = await scoutSource(source, {
      area: contract.area,
      ...options,
      state: seen,
      http: fakeHttp([{ status: 200, body }]),
    })
    assert.deepEqual(
      again.candidates.map((c) => c.change),
      ['unchanged'],
    )
    const changed = { sources: {}, seen: { [candidate.externalId]: 'f'.repeat(64) } }
    const updated = await scoutSource(source, {
      area: contract.area,
      ...options,
      state: changed,
      http: fakeHttp([{ status: 200, body }]),
    })
    assert.equal(updated.candidates[0].change, 'updated')
  })

  it('answers not-modified on a 304 and sends the saved ETag', async () => {
    const source = pilotSources(contract.registry)[1]
    const state = { sources: { [source.id]: { etag: '"abc"' } }, seen: {} }
    let sent
    const http = async (url, init) => {
      sent = init.headers['if-none-match']
      return new Response(null, { status: 304 })
    }
    const result = await scoutSource(source, {
      area: contract.area,
      state,
      http,
      budgets,
      validate,
      now: atNoon('2026-10-25'),
    })
    assert.equal(result.check.status, 'not-modified')
    assert.equal(sent, '"abc"')
  })

  it('keeps one candidate for the same item from two sources, citing the other', () => {
    const a = {
      sourceId: 'legistar-events',
      title: 'Listening session',
      startsAt: '2026-11-12T18:00:00-06:00',
      externalId: 'legistar-events:1',
      sourceUrl: 'https://a.example/1',
    }
    const b = {
      ...a,
      sourceId: 'mpl-pinney-events',
      externalId: 'mpl-pinney-events:x',
      sourceUrl: 'https://b.example/x',
    }
    const merged = mergeAcrossSources([[a], [b]])
    assert.equal(merged.length, 1)
    // The absorbed copy is tracked for the state, but never sent to the model
    assert.deepEqual(
      mergedCopies(merged[0]).map((c) => c.externalId),
      [b.externalId],
    )
    assert.ok(!JSON.stringify(merged[0]).includes('mergedCopies'))
    assert.deepEqual(merged[0].alsoReportedBy, [
      { sourceId: b.sourceId, sourceUrl: b.sourceUrl, externalId: b.externalId },
    ])
  })
})
