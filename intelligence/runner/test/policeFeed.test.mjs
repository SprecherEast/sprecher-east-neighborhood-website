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

  const placeOf = (description) =>
    parseIncidentReports(rss(entry({ ...carjacking, path: 'x', description })))[0].locationText

  it('reads the leading place of every shape the feed gives, as written', () => {
    for (const [description, place] of [
      ['100 block W. Main Street, Police need the public’s help.', '100 block W. Main Street'],
      ['200 block of State Street, A threat was reported.', '200 block of State Street'],
      ['5800 Block of Raymond Rd, Officers responded.', '5800 Block of Raymond Rd'],
      // The live feed puts a space before the comma on some items
      ['100 block Curry Pkwy , Officers responded.', '100 block Curry Pkwy'],
      [
        'Mineral Point Rd. at S. Gammon Rd., Officers responded.',
        'Mineral Point Rd. at S. Gammon Rd.',
      ],
      ['N Stoughton Road and Reider Road, Officers responded.', 'N Stoughton Road and Reider Road'],
      ['S. Blair St., Officers responded.', 'S. Blair St.'],
      // Every digit, plural street types, and the marks of live street names
      ['2900 block Curry Parkway, x', '2900 block Curry Parkway'],
      ['900 block Rise Lane, x', '900 block Rise Lane'],
      ['Stoughton and Pflaum roads, x', 'Stoughton and Pflaum roads'],
      ['Williamson and S. Ingersoll Streets, x', 'Williamson and S. Ingersoll Streets'],
      ['Huxley and Roth Streets, x', 'Huxley and Roth Streets'],
      ['S. BLAIR ST., x', 'S. BLAIR ST.'],
      ["O'Keeffe Ave and Main St, x", "O'Keeffe Ave and Main St"],
      ['Main St & Park St, x', 'Main St & Park St'],
      ['Hwy 12/18 at Sprecher Rd, x', 'Hwy 12/18 at Sprecher Rd'],
    ])
      assert.equal(placeOf(description), place, description)
  })

  it('gives no place when the description does not begin with one', () => {
    for (const description of [
      'UPDATE: Detectives with the Madison Police Department have arrested two suspects in the case, and more.',
      // A street named later in the text is not the leading place, even when a comma follows it
      'UPDATE - Police arrested a suspect. 7000 block Littlemore Dr, Officers responded.',
      'Officers responded to a report near 5 Main St late on Tuesday.',
      '100 block , A, B',
      // A street type has to be a whole word, and the update prefix has a colon
      'Westway and Main, Officers responded.',
      'Main Streetcar, Officers responded.',
      'UPDATE: Main St, Officers responded.',
      '',
    ])
      assert.equal(placeOf(description), null, description)
  })

  it('has one known limit: a short lead sentence with a street before its first comma is read', () => {
    // Only a hint for verify, which reads the whole report, and the boundary places a block;
    // on the live feed the place always leads
    assert.equal(
      placeOf('Officers arrested a man on Main St, late Tuesday.'),
      'Officers arrested a man on Main St',
    )
  })

  it('takes a leading place of at most 60 characters and 8 words, of plain street characters', () => {
    const sixty = `${'M'.repeat(57)} St`
    assert.equal(sixty.length, 60)
    assert.equal(placeOf(`${sixty}, x`), sixty)
    assert.equal(placeOf(`M${sixty}, x`), null)
    assert.equal(placeOf('A B C D E F G St, x'), 'A B C D E F G St')
    assert.equal(placeOf('A B C D E F G H St, x'), null)
    assert.equal(placeOf('Main St (rear), x'), null)
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
    assert.equal(before.url, before.ownId)
  })

  it('drops an item with no page of its own, or a page that is not https', () => {
    const body = rss(
      `<item><title>No link</title><description>x</description><guid>${BASE}/z#2026-11-20T08:44:31</guid></item>`,
      `<item><title>Plain</title><link>http://www.cityofmadison.com/police/incident-reports/q</link><description>x</description><guid>q</guid></item>`,
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
      lookAheadDays: contract.pipeline.lookAheadDays,
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
          // As the live feed gives an update: the description is replaced, with no place
          description: 'UPDATE: Police have since found the vehicle.',
        }),
      ),
      '2026-11-23',
    )
    assert.equal(second.candidates.length, 1)
    assert.equal(second.candidates[0].externalId, candidate.externalId)
    assert.equal(second.candidates[0].locationText, null)
    assert.equal(second.candidates[0].change, 'updated')
  })
})
