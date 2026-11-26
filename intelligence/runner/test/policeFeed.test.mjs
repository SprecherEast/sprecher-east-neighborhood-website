import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseIncidentReports } from '../lib/incidents.mjs'
import { PARSERS, parserFor } from '../lib/parsers.mjs'
import { scoutSource } from '../lib/scout.mjs'
import { markSeen } from '../lib/state.mjs'
import { atNoon, budgets, contract, fakeHttp } from './helpers.mjs'

// The Madison Police incident reports feed (#993): the block address is read from the start of
// the description and nothing else is added, the report's own page is the item's identity so an
// update reaches the editor as a change, and no title or wording decides anything.

const BASE = 'https://www.cityofmadison.com/police/incident-reports'
const rss = (...items) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Police Incident Reports</title>${items.join('')}</channel></rss>`
const entry = ({ path, stamp, title, description }) =>
  `<item><title>${title}</title><link>${BASE}/${path}</link><description><![CDATA[${description}]]></description><guid isPermaLink="false">${BASE}/${path}#${stamp}</guid><pubDate>Fri, 20 Nov 2026 08:44:30 -0600</pubDate></item>`

const carjacking = {
  path: '2026-11-19/armed-carjacking',
  stamp: '2026-11-20T08:44:31',
  title: 'Armed Carjacking',
  description:
    '2800 block Curry Pkwy, Officers responded to the 2800 block of Curry Pkwy after a caller reported their car being taken at gunpoint.&nbsp;',
}

describe('the incident reports parser', () => {
  it('is the parser for the source, and the source is polled', () => {
    const source = contract.registry.sources.find((s) => s.id === 'madison-police-incident-reports')
    assert.equal(source.result, 'valid')
    assert.ok(Number.isInteger(source.pilotRank))
    assert.equal(source.cadence, 'daily')
    assert.equal(parserFor(source), PARSERS['madison-police-incident-reports'])
  })

  it('reads the block address from the start of the description', () => {
    const [item] = parseIncidentReports(rss(entry(carjacking)))
    assert.equal(item.locationText, '2800 block Curry Pkwy')
    assert.equal(item.kind, 'news')
    assert.equal(item.url, `${BASE}/2026-11-19/armed-carjacking`)
    assert.match(item.sourceText, /^2800 block Curry Pkwy, Officers responded/)
  })

  it('reads a block with a direction, "of", and a street type', () => {
    const items = parseIncidentReports(
      rss(
        entry({
          ...carjacking,
          path: 'a',
          description: '100 block W. Main Street, Police need the public’s help.',
        }),
        entry({
          ...carjacking,
          path: 'b',
          description: '200 block of State Street, A threat was reported.',
        }),
      ),
    )
    assert.deepEqual(
      items.map((i) => i.locationText),
      ['100 block W. Main Street', '200 block of State Street'],
    )
  })

  it('gives no place when the description does not begin with one', () => {
    const items = parseIncidentReports(
      rss(
        entry({
          ...carjacking,
          path: 'a',
          description: 'UPDATE: Detectives have arrested two suspects.',
        }),
        // A street named later in the text is not the block address: nothing is guessed
        entry({
          ...carjacking,
          path: 'b',
          description: 'Officers responded to a report near 5 Main St late on Tuesday.',
        }),
        entry({ ...carjacking, path: 'c', description: '' }),
      ),
    )
    assert.deepEqual(
      items.map((i) => i.locationText),
      [null, null, null],
    )
  })

  it('never takes the place from the title', () => {
    const [item] = parseIncidentReports(
      rss(
        entry({
          ...carjacking,
          title: 'Shots fired, 900 block Fake Rd',
          description: 'Officers responded.',
        }),
      ),
    )
    assert.equal(item.locationText, null)
  })

  it('identifies a report by its own page, so an update keeps the id the guid would change', () => {
    const [before] = parseIncidentReports(rss(entry(carjacking)))
    const [after] = parseIncidentReports(
      rss(
        entry({
          ...carjacking,
          stamp: '2026-11-22T09:00:00',
          description: `UPDATE: ${carjacking.description}`,
        }),
      ),
    )
    assert.equal(before.ownId, `${BASE}/2026-11-19/armed-carjacking`)
    assert.equal(after.ownId, before.ownId)
  })

  it('drops an item with no page of its own rather than naming it by a timestamp', () => {
    const body = rss(
      `<item><title>No link</title><description>x</description><guid>${BASE}/z#2026-11-20T08:44:31</guid></item>`,
    )
    assert.deepEqual(parseIncidentReports(body), [])
  })
})

describe('scouting the incident reports feed', () => {
  const source = contract.registry.sources.find((s) => s.id === 'madison-police-incident-reports')
  const validate = contract.validator('schemas/candidate.schema.json')
  const run = (state, body, day = '2026-11-22') =>
    scoutSource(source, {
      area: contract.area,
      state,
      http: fakeHttp([{ via: 'direct', status: 200, contentType: 'application/rss+xml', body }]),
      budgets,
      validate,
      now: atNoon(day),
    })

  it('makes a candidate with the block address, and an update to a known report is a change', async () => {
    const state = { sources: {}, seen: {} }
    const first = await run(state, rss(entry(carjacking)))
    assert.equal(first.check.status, 'ok')
    assert.deepEqual(first.invalid, [])
    const [candidate] = first.candidates
    assert.equal(candidate.locationText, '2800 block Curry Pkwy')
    assert.equal(candidate.sourceId, 'madison-police-incident-reports')
    assert.equal(candidate.change, 'new')
    // What was handled is remembered, as submit does after a run
    markSeen(state, candidate.externalId, candidate.contentHash)

    const second = await run(
      state,
      rss(
        entry({
          ...carjacking,
          stamp: '2026-11-22T09:00:00',
          description: `${carjacking.description} Police have since found the vehicle.`,
        }),
      ),
      '2026-11-23',
    )
    assert.equal(second.candidates.length, 1)
    assert.equal(second.candidates[0].externalId, candidate.externalId)
    assert.equal(second.candidates[0].change, 'updated')
  })
})
