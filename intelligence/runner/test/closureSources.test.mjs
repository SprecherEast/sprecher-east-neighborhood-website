import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { pilotSources } from '../lib/contract.mjs'
import { parseCityArticles } from '../lib/html.mjs'
import { parserFor } from '../lib/parsers.mjs'
import { areaMatcher, keepItem, scoutSource } from '../lib/scout.mjs'
import { atNoon, budgets, contract, fakeHttp } from './helpers.mjs'

// The road closure and traffic change sources (#994), on a trimmed copy of the City's closure news
// list (pages/README.md, served 2026-11-26). The day is 2026-10-26: the Monday the County Highway T
// closure at Felland Road began, which the site missed.

const page = readFileSync(new URL('./pages/city-closure-news.html', import.meta.url), 'utf8')
const source = (id) => contract.registry.sources.find((s) => s.id === id)
const closures = source('city-traffic-engineering-news')
const validate = contract.validator('schemas/candidate.schema.json')
const namesArea = areaMatcher(contract.area)
const TODAY = '2026-10-26'

const dryRun = () =>
  scoutSource(closures, {
    area: contract.area,
    state: { sources: {}, seen: {} },
    http: fakeHttp([{ status: 200, contentType: 'text/html', body: page }]),
    budgets,
    validate,
    lookAheadDays: contract.pipeline.lookAheadDays,
    now: atNoon(TODAY),
  })

describe('the City closure news list', () => {
  it('is a polled source reading the City news list filtered to street and lane closures', () => {
    assert.equal(closures.result, 'valid')
    assert.equal(closures.format, 'html')
    assert.equal(closures.canonicalUrl, 'https://www.cityofmadison.com/news?category=1031')
    assert.equal(closures.robots.result, 'allowed')
    assert.equal(parserFor(closures), parseCityArticles)
    assert.ok(pilotSources(contract.registry).some((s) => s.id === closures.id))
  })

  it('reads the posts from the last 14 days and drops an older one', () => {
    const items = parseCityArticles(page, { base: closures.canonicalUrl, from: TODAY })
    assert.deepEqual(
      items.map((i) => i.title),
      [
        'Closure of Eastbound W Dayton Street between N Charter and N Mills Streets',
        'Highway T Closure at Felland Road Begins October 26',
        'South Stoughton Road Service Road Closure at Pflaum Road Begins October 21',
      ],
    )
  })

  it('keeps every closure for verify, because the list text cuts off before the detour', async () => {
    const items = parseCityArticles(page, { base: closures.canonicalUrl, from: TODAY })
    const highwayT = items.find((i) => /Highway T/.test(i.title))
    // The detour over Sprecher Road and Milwaukee Street is on the post's own page, not the list
    assert.equal(namesArea(`${highwayT.title} ${highwayT.sourceText}`), false)
    assert.equal(keepItem(closures, highwayT, namesArea), true)
    const result = await dryRun()
    assert.deepEqual(result.invalid, [])
    assert.equal(result.check.status, 'ok')
    const found = result.candidates.find((c) => /Highway T/.test(c.title))
    assert.equal(
      found.url ?? found.sourceUrl,
      'https://www.cityofmadison.com/news/2026-10-19/highway-t-closure-at-felland-road-begins-october-26',
    )
    assert.equal(found.externalId.startsWith('city-traffic-engineering-news:'), true)
    assert.match(found.sourceText, /October 26/)
    assert.equal(result.candidates.length, 3)
  })
})

describe('the other closure sources', () => {
  it('records the Road Closures layer as invalid: its newest closure ended in 2021', () => {
    const layer = source('madison-road-closures-layer')
    assert.equal(layer.result, 'invalid')
    assert.equal(layer.lastChecked, '2026-11-26')
    assert.match(layer.notes, /2021-12-16/)
    assert.equal(
      pilotSources(contract.registry).some((s) => s.id === layer.id),
      false,
    )
  })

  it('keeps 511 Wisconsin pending, because its API needs a developer key', () => {
    const api = source('wisconsin-511-events-api')
    assert.equal(api.result, 'pending')
    assert.match(api.access, /key/i)
    assert.equal(api.robots.checked, '2026-11-26')
    assert.equal(
      pilotSources(contract.registry).some((s) => s.id === api.id),
      false,
    )
  })
})
