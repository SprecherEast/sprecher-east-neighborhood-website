import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { pilotSources } from '../lib/contract.mjs'
import { parseCityEvents, parseParksEvents, parseParkStatus } from '../lib/html.mjs'
import { parserFor } from '../lib/parsers.mjs'
import { areaMatcher, keepItem, scoutSource } from '../lib/scout.mjs'
import { atNoon, budgets, contract, fakeHttp } from './helpers.mjs'

// The Parks event list and the park status pages (#995), on trimmed copies of their real markup
// (pages/README.md, served 2026-11-26).

const page = (name) => readFileSync(new URL(`./pages/${name}`, import.meta.url), 'utf8')
const source = (id) => contract.registry.sources.find((s) => s.id === id)
const BASE = 'https://www.cityofmadison.com/parks/events'
const validate = contract.validator('schemas/candidate.schema.json')
const namesArea = areaMatcher(contract.area)
const TODAY = '2026-11-26'

describe('the Parks event list', () => {
  it('reads each event as an event with its own page, time, place and address', () => {
    const items = parseParksEvents(page('madison-parks-events.html'), { base: BASE, from: TODAY })
    const door = items.find((i) => i.title === 'Groove & Glide | Door Creek')
    assert.deepEqual(door, {
      ownId: '/parks/events/2027-01-22/groove-glide-door-creek@2027-01-22T18:00:00-06:00',
      kind: 'event',
      title: 'Groove & Glide | Door Creek',
      sourceText: 'Door Creek Park 7035 Littlemore Drive',
      startsAt: '2027-01-22T18:00:00-06:00',
      endsAt: '2027-01-22T20:00:00-06:00',
      allDay: false,
      locationText: 'Door Creek Park 7035 Littlemore Drive',
      sourceStatus: 'scheduled',
      url: 'https://www.cityofmadison.com/parks/events/2027-01-22/groove-glide-door-creek',
      modified: null,
    })
  })

  it('keeps a golf course meeting on a /parks/golf path, and drops an event already over', () => {
    const items = parseParksEvents(page('madison-parks-events.html'), {
      base: BASE,
      from: '2026-11-29',
    })
    assert.deepEqual(
      items.map((i) => i.title),
      ['Public Meeting - Yahara Hills Improvements', 'Groove & Glide | Door Creek'],
    )
  })

  it('shares the City event markup, so the meeting list and the Parks list read alike but differ in kind', () => {
    const body = page('madison-parks-events.html')
    const meetings = parseCityEvents(body, { base: BASE })
    const events = parseParksEvents(body, { base: BASE })
    assert.deepEqual(
      meetings.map((m) => m.kind),
      meetings.map(() => 'meeting'),
    )
    assert.deepEqual(
      events.map((m) => m.kind),
      events.map(() => 'event'),
    )
    assert.equal(events.length, meetings.length)
  })

  it('is a polled source with its own parser that reads two pages', () => {
    const parks = source('madison-parks-events')
    assert.equal(parserFor(parks), parseParksEvents)
    assert.ok(pilotSources(contract.registry).some((s) => s.id === parks.id))
    assert.equal(parks.pages, 2)
  })

  it('surfaces the Door Creek Park event in a dry run over both list pages', async () => {
    const parks = source('madison-parks-events')
    const first = page('madison-parks-events.html')
    const http = fakeHttp([
      { status: 200, contentType: 'text/html', body: first },
      { status: 200, contentType: 'text/html', body: page('madison-parks-events-2.html') },
    ])
    const result = await scoutSource(parks, {
      area: contract.area,
      state: { sources: {}, seen: {} },
      http,
      budgets,
      validate,
      lookAheadDays: contract.pipeline.lookAheadDays,
      now: atNoon(TODAY),
    })
    assert.deepEqual(http.requested, [BASE, `${BASE}?page=1`])
    assert.deepEqual(result.invalid, [])
    const door = result.candidates.find((c) => /Door Creek/.test(c.title))
    assert.equal(door.kind, 'event')
    assert.equal(door.externalId.startsWith('madison-parks-events:'), true)
    assert.match(door.locationText, /7035 Littlemore Drive/)
    assert.ok(namesArea(`${door.title} ${door.locationText}`), 'the area words see the park')
    assert.equal(result.candidates.length, 4)
  })

  it('stops reading pages when one is empty or fails, and keeps what it has', async () => {
    const parks = source('madison-parks-events')
    const http = fakeHttp([
      { status: 200, contentType: 'text/html', body: page('madison-parks-events.html') },
      { status: 404 },
    ])
    const result = await scoutSource(parks, {
      area: contract.area,
      state: { sources: {}, seen: {} },
      http,
      budgets,
      validate,
      lookAheadDays: 60,
      now: atNoon(TODAY),
    })
    assert.equal(result.check.status, 'ok')
    assert.equal(result.candidates.length, 3)
    assert.match(result.check.error ?? '', /page 2/)
  })
})

describe('the Door Creek Park winter status', () => {
  const ski = source('door-creek-park-ski')
  const ice = source('door-creek-park-ice')
  const base = 'https://www.cityofmadison.com/parks/find-a-park/winter/ski'
  // The page's second place is Door Creek Park: its tag says "Open" instead
  const closed = page('parks-ski-trails.html')
  const at = closed.lastIndexOf('Closed for Season')
  const open = `${closed.slice(0, at)}Open${closed.slice(at + 'Closed for Season'.length)}`

  it('is two polled sources read by one parser', () => {
    for (const s of [ski, ice]) {
      assert.equal(parserFor(s), parseParkStatus, s.id)
      assert.ok(
        pilotSources(contract.registry).some((p) => p.id === s.id),
        s.id,
      )
    }
  })

  it('says nothing while a park is closed for the season', () => {
    assert.deepEqual(parseParkStatus(page('parks-ski-trails.html'), { base, from: TODAY }), [])
  })

  it('answers an item when the park shows any other status, named for its season', () => {
    const [item] = parseParkStatus(open, { base, from: TODAY })
    assert.equal(item.title, 'Door Creek Park Cross-Country Skiing: Open')
    assert.equal(item.ownId, '/parks/find-a-park/door-creek/cross-country-skiing@2026-27')
    assert.equal(item.kind, 'news')
    assert.equal(item.startsAt, null)
    assert.equal(item.locationText, '7035 Littlemore Dr.')
    assert.equal(
      item.url,
      'https://www.cityofmadison.com/parks/find-a-park/door-creek/cross-country-skiing',
    )
  })

  it('names the season by the winter it belongs to, from August on', () => {
    const at = (from) => parseParkStatus(open, { base, from })[0].ownId.split('@')[1]
    assert.deepEqual(
      [at('2027-01-10'), at('2026-12-31'), at('2027-07-31'), at('2027-08-01')],
      ['2026-27', '2026-27', '2026-27', '2027-28'],
    )
  })

  it('goes on only for a park the area words name', () => {
    const items = parseParkStatus(open.replaceAll('Closed for Season', 'Open'), {
      base,
      from: TODAY,
    })
    const kept = items.filter((i) => keepItem(ski, i, namesArea))
    assert.deepEqual(
      kept.map((i) => i.title),
      ['Door Creek Park Cross-Country Skiing: Open'],
    )
    assert.ok(items.length > kept.length)
  })

  it('treats a status change as a new version of the same item, so “open” becomes an update', async () => {
    const run = (body) =>
      scoutSource(ski, {
        area: contract.area,
        state: { sources: {}, seen: {} },
        http: fakeHttp([{ status: 200, contentType: 'text/html', body }]),
        budgets,
        validate,
        lookAheadDays: 60,
        now: atNoon('2026-12-20'),
      })
    const result = await run(open)
    assert.deepEqual(result.invalid, [])
    assert.deepEqual(
      result.candidates.map((c) => c.title),
      ['Door Creek Park Cross-Country Skiing: Open'],
    )
  })
})
