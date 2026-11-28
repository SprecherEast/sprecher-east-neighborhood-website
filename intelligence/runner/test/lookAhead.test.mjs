import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { scoutSource, sourceUrl } from '../lib/scout.mjs'
import { markSeen } from '../lib/state.mjs'
import { atNoon, budgets, contract, fakeHttp } from './helpers.mjs'

// How far ahead scout looks (#995): one default in pipeline.yaml, and a source that publishes
// earlier sets its own in sources.yaml.

const TODAY = '2026-11-26'
const legistar = contract.registry.sources.find((s) => s.id === 'legistar-events')
const pinney = contract.registry.sources.find((s) => s.id === 'mpl-pinney-events')
const freshState = () => ({ sources: {}, seen: {} })
const validate = contract.validator('schemas/candidate.schema.json')
const days = contract.pipeline.lookAheadDays

const ics = (...dates) =>
  [
    'BEGIN:VCALENDAR',
    ...dates.flatMap((d, i) => [
      'BEGIN:VEVENT',
      `UID:far-${i}`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:Event ${i}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n')

const scout = (source, body, lookAheadDays = days) =>
  scoutSource(source, {
    area: contract.area,
    state: freshState(),
    http: fakeHttp([{ status: 200, contentType: 'text/calendar', body }]),
    budgets,
    validate,
    lookAheadDays,
    now: atNoon(TODAY),
  })

describe('the look-ahead', () => {
  it('is at least two months by default (the owner’s decision, 2026-11-23)', () => {
    assert.ok(days >= 60, `${days} days`)
  })

  it('fills {to} with today plus the default, or the source’s own setting', () => {
    const own = { ...legistar, feedUrl: 'https://x.test/e?from={from}&to={to}', lookAheadDays: 120 }
    const plain = { ...own, lookAheadDays: undefined }
    assert.equal(
      sourceUrl(plain, { today: TODAY, lookAheadDays: 60 }),
      `https://x.test/e?from=${TODAY}&to=2027-01-25`,
    )
    assert.equal(
      sourceUrl(own, { today: TODAY, lookAheadDays: 60 }),
      `https://x.test/e?from=${TODAY}&to=2027-03-26`,
    )
  })

  it('stops a calendar feed at the default window and reaches further for a source that sets more', async () => {
    const body = ics('20261230', '20270215')
    const narrow = await scout(pinney, body)
    assert.deepEqual(
      narrow.candidates.map((c) => c.title),
      ['Event 0'],
    )
    const wide = await scout({ ...pinney, lookAheadDays: 120 }, body)
    assert.deepEqual(
      wide.candidates.map((c) => c.title),
      ['Event 0', 'Event 1'],
    )
  })

  it('lets a registry source set it, and refuses a value outside 1 to 365', () => {
    const check = contract.validator('schemas/sources.schema.json')
    const registry = structuredClone(contract.registry)
    registry.sources[0].lookAheadDays = 90
    assert.deepEqual(check(registry), [])
    registry.sources[0].lookAheadDays = 0
    assert.notDeepEqual(check(registry), [])
    registry.sources[0].lookAheadDays = 400
    assert.notDeepEqual(check(registry), [])
  })

  it('sees a far-off event again when its details change, so it is checked closer to its date', async () => {
    const state = freshState()
    const run = (summary) =>
      scoutSource(pinney, {
        area: contract.area,
        state,
        http: fakeHttp([
          {
            status: 200,
            contentType: 'text/calendar',
            body: ics('20270120').replace('Event 0', summary),
          },
        ]),
        budgets,
        validate,
        lookAheadDays: 90,
        now: atNoon(TODAY),
      })
    const first = await run('Groove night')
    assert.equal(first.candidates[0].change, 'new')
    markSeen(state, first.candidates[0].externalId, first.candidates[0].contentHash)
    const again = await run('Groove night')
    assert.equal(again.candidates[0].change, 'unchanged')
    const moved = await run('Groove night (moved indoors)')
    assert.equal(moved.candidates[0].change, 'updated')
  })
})
