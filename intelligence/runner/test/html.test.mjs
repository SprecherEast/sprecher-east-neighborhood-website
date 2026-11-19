import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  clockIn,
  NEWS_DAYS,
  parseCityArticles,
  parseCityEvents,
  parseWisdotMeetings,
} from '../lib/html.mjs'
import { parserFor } from '../lib/parsers.mjs'
import { areaMatcher, keepItem, scoutSource } from '../lib/scout.mjs'
import { atNoon, budgets, contract, fakeHttp } from './helpers.mjs'

// The HTML parsers (#390), on trimmed copies of each page's real markup (test/pages/README.md).

const page = (name) => readFileSync(new URL(`./pages/${name}`, import.meta.url), 'utf8')
const source = (id) => contract.registry.sources.find((s) => s.id === id)
/** Parses a page; without `from`, nothing is left out for being past. */
const parse = (id, name, from) =>
  parserFor(source(id))(page(name), { base: source(id).canonicalUrl, from })
const kept = (id, items) =>
  items.filter((item) => keepItem(source(id), item, areaMatcher(contract.area)))

describe('City article lists: the District 16 blog and City news', () => {
  it('reads each post as news with its own address, title, summary and posted time', () => {
    const [post] = parse('district16-blog', 'district16-blog.html')

    assert.deepEqual(post, {
      ownId: '/council/district16/blog/2026-10-27/upcoming-public-information-meetings',
      kind: 'news',
      title: 'Upcoming Public Information Meetings',
      sourceText:
        "Draft Framework to Regulate Data Centers in Madison PMI. The City of Madison's Department of Planning and Community and Economic Development will hold a public information meeting on Tuesday, October 27, 2026, to update community members on a draft…",
      startsAt: null,
      endsAt: null,
      allDay: null,
      locationText: null,
      sourceStatus: 'unknown',
      url: 'https://www.cityofmadison.com/council/district16/blog/2026-10-27/upcoming-public-information-meetings',
      modified: '2026-10-27T12:08:19-05:00',
    })
  })

  it('strips scripts from the summary, and leaves out a link to another site', () => {
    const posts = parse('district16-blog', 'district16-blog.html')

    assert.equal(posts.length, 2)
    assert.doesNotMatch(posts[1].sourceText, /script|alert/)
    assert.ok(posts.every((p) => p.url.startsWith('https://www.cityofmadison.com/')))
  })

  it(`keeps only posts from the last ${NEWS_DAYS} days, so old posts never cost a model call`, () => {
    const posts = parse('district16-blog', 'district16-blog.html', '2026-10-27')

    assert.deepEqual(
      posts.map((p) => p.title),
      ['Upcoming Public Information Meetings'],
    )
  })

  it('keeps a post exactly 14 days old and drops one from 15 days ago', () => {
    const post = (date) =>
      `<div class="article-summary"><h2 class="article-title"><a href="/news/${date}/p">Post</a></h2><time datetime="${date}T09:00:00-05:00"></time></div>`
    const dates = parseCityArticles(post('2026-10-13') + post('2026-10-12'), {
      base: 'https://www.cityofmadison.com/news',
      from: '2026-10-27',
    }).map((p) => p.modified.slice(0, 10))

    assert.deepEqual(dates, ['2026-10-13'])
  })

  it('treats the site with or without www as its own', () => {
    const [post] = parseCityArticles(
      '<div class="article-summary"><h2 class="article-title"><a href="https://cityofmadison.com/news/a">A</a></h2></div>',
      { base: 'https://www.cityofmadison.com/news' },
    )

    assert.equal(post.url, 'https://cityofmadison.com/news/a')
  })

  it('reads City news with the same parser, and keeps only releases that name the area', () => {
    const news = parse('city-news', 'city-news.html')

    assert.equal(news.length, 2)
    assert.deepEqual(
      kept('city-news', news).map((i) => i.title),
      ['Cottage Grove Road Resurfacing Begins'],
    )
  })

  it('answers no items, not guessed ones, for a page whose markup changed', () => {
    assert.deepEqual(
      parseCityArticles('<main><p>Redesigned</p></main>', { base: 'https://x.gov/' }),
      [],
    )
  })
})

describe('City public information meetings', () => {
  it('reads start, end and venue from the page’s own date-times and address', () => {
    const [virtual, inPerson] = parse('city-public-info-meetings', 'public-info-meetings.html')

    assert.equal(virtual.title, 'Draft Data Center Regulation Framework Public Information Meeting')
    assert.equal(virtual.kind, 'meeting')
    assert.equal(virtual.startsAt, '2026-10-27T17:30:00-05:00')
    assert.equal(virtual.endsAt, '2026-10-27T19:30:00-05:00')
    assert.equal(virtual.allDay, false)
    assert.equal(virtual.locationText, 'Virtual event')
    assert.equal(virtual.sourceStatus, 'scheduled')
    assert.match(virtual.sourceText, /Tag: Full/)
    assert.equal(
      virtual.url,
      'https://www.cityofmadison.com/dpced/events/2026-10-27/draft-data-center-regulation-framework-public-information-meeting',
    )
    assert.equal(inPerson.locationText, 'Freedom Inc Office 2110 Luann Lane')
  })

  it('marks a meeting whose tag says it is cancelled', () => {
    const meetings = parse('city-public-info-meetings', 'public-info-meetings.html')

    assert.equal(meetings[2].sourceStatus, 'cancelled')
    assert.equal(meetings[2].startsAt, '2026-11-12T18:00:00-06:00')
  })

  it('gives each meeting an id from its page and start, so a moved meeting is a new item', () => {
    const ids = parse('city-public-info-meetings', 'public-info-meetings.html').map((m) => m.ownId)

    assert.equal(new Set(ids).size, 3)
    assert.equal(
      ids[1],
      '/independent-police-monitor/events/2026-10-29/pcob-hiring-listening-session@2026-10-29T18:00:00-05:00',
    )
  })

  it('leaves out meetings that ended before today', () => {
    const meetings = parse('city-public-info-meetings', 'public-info-meetings.html', '2026-10-28')

    assert.deepEqual(
      meetings.map((m) => m.startsAt.slice(0, 10)),
      ['2026-10-29', '2026-11-12'],
    )
  })
})

describe('WisDOT I-39/90/94 meetings', () => {
  it('takes a meeting’s time from where the page states it for that day', () => {
    const [corridor] = parse('wisdot-i39-90-94', 'wisdot-news-and-meetings.html')

    assert.equal(corridor.title, 'Corridor-wide Virtual Public Meeting')
    // November 10 is after the clocks change: Central Standard Time
    assert.equal(corridor.startsAt, '2026-11-10T17:30:00-06:00')
    assert.equal(corridor.allDay, false)
    assert.doesNotMatch(corridor.sourceText, /gives no time/)
    assert.equal(corridor.locationText, 'Virtual meeting')
    assert.equal(corridor.url, source('wisdot-i39-90-94').canonicalUrl)
  })

  it('takes the time from the description when it gives one, in the site’s timezone', () => {
    const [, lyndon] = parse('wisdot-i39-90-94', 'wisdot-news-and-meetings.html')

    assert.equal(lyndon.startsAt, '2026-10-29T17:00:00-05:00')
    assert.match(lyndon.sourceText, /Juneau County/)
  })

  it('keeps a month-only meeting without a start, and drops an empty placeholder box', () => {
    const meetings = parse('wisdot-i39-90-94', 'wisdot-news-and-meetings.html')

    assert.deepEqual(
      meetings.map((m) => m.title),
      [
        'Corridor-wide Virtual Public Meeting',
        'Upcoming Public Meeting',
        'Noise Barrier Public Meeting',
      ],
    )
    assert.equal(meetings[2].startsAt, null)
    assert.match(
      meetings[2].sourceText,
      /^Date given as "august 2026"; the page's listing gives no time/,
    )
  })

  it('leaves out past meetings, and keeps only the corridor’s own meetings for a model', () => {
    const upcoming = parse('wisdot-i39-90-94', 'wisdot-news-and-meetings.html', '2026-10-27')

    // August has passed; the October 29 meeting is on US 12 in Juneau County
    assert.deepEqual(
      upcoming.map((m) => m.title),
      ['Corridor-wide Virtual Public Meeting', 'Upcoming Public Meeting'],
    )
    assert.deepEqual(
      kept('wisdot-i39-90-94', upcoming).map((m) => m.title),
      ['Corridor-wide Virtual Public Meeting'],
    )
  })

  it('keys a dated meeting on its day, so a new title is the same item (an update)', () => {
    const before = parse('wisdot-i39-90-94', 'wisdot-news-and-meetings.html')
    const retitled = parseWisdotMeetings(
      page('wisdot-news-and-meetings.html').replace(
        'Corridor-wide Virtual Public Meeting',
        'Corridor-wide Virtual Public Information Meeting',
      ),
      { base: source('wisdot-i39-90-94').canonicalUrl },
    )

    assert.equal(before[0].ownId, '2026-11-10')
    assert.equal(retitled[0].ownId, before[0].ownId)
    assert.equal(before[2].ownId, 'august-2026-noise-barrier-public-meeting')
  })

  it('tells two meetings on the same day apart by their titles', () => {
    const box = (title) =>
      `<div><h1 class="subhead-small-pim">november 10, 2026</h1><h1>${title}</h1><p>At 6 p.m.</p></div>`
    const ids = parseWisdotMeetings(box('Open house') + box('Hearing'), {
      base: 'https://x.gov/',
    }).map((m) => m.ownId)

    assert.deepEqual(ids, ['2026-11-10-open-house', '2026-11-10-hearing'])
  })

  it('keeps the project’s own meetings however they name the road; drops other roads’', () => {
    const meeting = (title, text) => ({ title, sourceText: text, locationText: null })
    const keep = (item) => kept('wisdot-i39-90-94', [item]).length === 1

    assert.ok(
      keep(meeting('Noise wall vote', 'Interstate 39/90/94 neighbors vote on noise walls.')),
    )
    assert.ok(keep(meeting('Noise barrier meeting', 'Vote on noise barriers near your home.')))
    assert.ok(keep(meeting('Public meeting', 'Updates on the I-39/90/94 project and US 51.')))
    assert.ok(keep(meeting('WIS 30 interchange', 'Design options for the WIS 30 interchange.')))
    assert.ok(!keep(meeting('Public meeting', 'Rehabilitation of US 12 in Juneau County.')))
    assert.ok(!keep(meeting('Public hearing', 'Resurfacing County HH near Lyndon Station.')))
  })

  it('borrows the page’s time for a day only when one box and one sentence name that day', () => {
    const box = (day, title) =>
      `<div><h1 class="subhead-small-pim">november ${day}, 2026</h1><h1>${title}</h1><p>Details soon.</p></div>`
    const said = (day, time) => `<p>Join us on November ${day}, 2026, at ${time}.</p>`
    const base = { base: 'https://x.gov/' }

    const [one] = parseWisdotMeetings(box(10, 'Virtual meeting') + said(10, '5:30 p.m.'), base)
    assert.equal(one.startsAt, '2026-11-10T17:30:00-06:00')

    const twoSentences = said(10, '9 a.m.') + said(10, '5:30 p.m.')
    const [unsure] = parseWisdotMeetings(box(10, 'Virtual meeting') + twoSentences, base)
    assert.equal(unsure.startsAt, null)

    // The same day written two ways is still two boxes on one day
    const twoBoxes =
      box(10, 'Open house') +
      box(10, 'Hearing').replace('november 10, 2026', 'November 10,2026') +
      said(10, '5:30 p.m.')
    assert.deepEqual(
      parseWisdotMeetings(twoBoxes, base).map((m) => m.startsAt),
      [null, null],
    )
  })

  it('keeps a meeting dated today and a month-only one until that month ends', () => {
    const box = (date) =>
      `<div><h1 class="subhead-small-pim">${date}</h1><h1>Meeting</h1><p>On the corridor.</p></div>`
    const titles = (from, dates) =>
      parseWisdotMeetings(dates.map(box).join(''), { base: 'https://x.gov/', from }).map(
        (m) => m.ownId,
      )

    assert.deepEqual(titles('2026-11-10', ['november 10, 2026', 'november 9, 2026']), [
      '2026-11-10',
    ])
    assert.equal(titles('2026-11-30', ['november 2026']).length, 1)
    assert.equal(titles('2026-12-01', ['november 2026']).length, 0)
    assert.equal(titles('2026-12-31', ['december 2026']).length, 1)
    assert.equal(titles('2027-01-01', ['december 2026']).length, 0)
  })

  it('answers no items for a page without meeting boxes', () => {
    assert.deepEqual(parseWisdotMeetings('<h1>News</h1>', { base: 'https://x.gov/' }), [])
    assert.deepEqual(parseCityEvents('<h1>Events</h1>', { base: 'https://x.gov/' }), [])
  })
})

describe('clockIn', () => {
  for (const [text, expected] of [
    ['at 5:30 p.m.', { hour: 17, minute: 30 }],
    ['6 PM', { hour: 18, minute: 0 }],
    ['from 5 to 7 p.m.', { hour: 17, minute: 0 }],
    ['5:30-7 p.m.', { hour: 17, minute: 30 }],
    ['11 to 1 p.m.', { hour: 11, minute: 0 }],
    ['noon to 2 p.m.', { hour: 12, minute: 0 }],
    ['12 to 1 p.m.', { hour: 12, minute: 0 }],
    ['9 a.m. to 3 p.m.', { hour: 9, minute: 0 }],
    ['I-94 at 5', null],
  ]) {
    it(`reads "${text}" as ${expected ? `${expected.hour}:${expected.minute}` : 'no time'}`, () => {
      assert.deepEqual(clockIn(text), expected)
    })
  }
})

describe('scouting an HTML source end to end', () => {
  it('turns the WisDOT page into schema-valid candidates: only the corridor’s next meeting', async () => {
    const http = fakeHttp([
      { status: 200, contentType: 'text/html', body: page('wisdot-news-and-meetings.html') },
    ])
    const result = await scoutSource(source('wisdot-i39-90-94'), {
      area: contract.area,
      state: { sources: {}, seen: {} },
      http,
      budgets,
      validate: contract.validator('schemas/candidate.schema.json'),
      now: atNoon('2026-10-27'),
    })

    assert.equal(result.check.status, 'ok')
    assert.deepEqual(result.invalid, [])
    assert.deepEqual(
      result.candidates.map((c) => [c.title, c.startsAt]),
      [['Corridor-wide Virtual Public Meeting', '2026-11-10T17:30:00-06:00']],
    )
    assert.deepEqual(http.requested, [source('wisdot-i39-90-94').canonicalUrl])
  })
})
