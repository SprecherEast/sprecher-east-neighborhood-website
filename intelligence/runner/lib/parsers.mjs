import { XMLParser } from 'fast-xml-parser'

import { collapse, toSourceText } from './text.mjs'
import { parseCityArticles, parseCityEvents, parseWisdotMeetings } from './html.mjs'
import { parseIcs } from './ics.mjs'
import { parseClock, zonedIso } from './time.mjs'

// One parser per source format (scout.md step 4). Each answers raw items: the source's own ID and
// the candidate fields as the source gives them. Scout adds provenance, hashing and change.

const ymd = (text) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text ?? '')
  return match ? { year: +match[1], month: +match[2], day: +match[3] } : null
}

/** Legistar's status words: a cancellation wins over "rescheduled to ...". */
function legistarStatus(...texts) {
  const all = texts
    .filter(Boolean)
    .join(' ')
    .replace(/\bnot\s+(been\s+)?(cancel\w*|reschedul\w*|postpon\w*)/gi, '')
  if (/cancel/i.test(all)) return 'cancelled'
  if (/reschedul|postpon/i.test(all)) return 'rescheduled'
  return 'scheduled'
}

/** Legistar events: a local date (`EventDate`) and a local clock time (`EventTime`). */
export function parseLegistarEvents(body) {
  const rows = JSON.parse(body)
  if (!Array.isArray(rows)) throw new Error('Legistar events: expected a JSON array')
  return rows.map((row) => {
    const day = ymd(row.EventDate)
    const clock = parseClock(row.EventTime)
    // A day with no published time has no start: the date goes in the text for verify to see
    const startsAt = day && clock ? zonedIso({ ...day, ...clock }) : null
    const status = legistarStatus(row.EventAgendaStatusName, row.EventComment)
    const dateNote = day && !clock ? `Date ${row.EventDate.slice(0, 10)}, time not published` : null
    return {
      ownId: String(row.EventId),
      kind: 'meeting',
      title: collapse(row.EventBodyName) || 'Meeting',
      sourceText: toSourceText(
        [dateNote, row.EventComment, row.EventAgendaStatusName].filter(Boolean).join('. '),
      ),
      startsAt,
      endsAt: null,
      allDay: startsAt ? false : null,
      locationText: collapse(row.EventLocation) || null,
      sourceStatus: status,
      url:
        typeof row.EventInSiteURL === 'string' && row.EventInSiteURL.startsWith('https://')
          ? row.EventInSiteURL
          : null,
      modified: row.EventLastModifiedUtc ?? null,
    }
  })
}

/** Legistar matters: legislation, no date of its own; the cursor is the newest change. */
export function parseLegistarMatters(body) {
  const rows = JSON.parse(body)
  if (!Array.isArray(rows)) throw new Error('Legistar matters: expected a JSON array')
  return rows.map((row) => ({
    ownId: String(row.MatterId),
    kind: 'legislation',
    title: collapse(row.MatterTitle || row.MatterName || `File ${row.MatterFile}`).slice(0, 300),
    sourceText: toSourceText(
      [
        row.MatterFile && `File ${row.MatterFile}`,
        row.MatterTypeName,
        row.MatterStatusName,
        row.MatterTitle,
      ]
        .filter(Boolean)
        .join('. '),
    ),
    startsAt: null,
    endsAt: null,
    allDay: null,
    locationText: null,
    sourceStatus: 'unknown',
    url: `https://webapi.legistar.com/v1/madison/matters/${row.MatterId}`,
    modified: row.MatterLastModifiedUtc ?? null,
  }))
}

const xml = new XMLParser({ ignoreAttributes: false, processEntities: true, trimValues: true })
const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value])
const textOf = (value) =>
  typeof value === 'object' && value !== null ? (value['#text'] ?? '') : (value ?? '')

/** RSS 2.0 or Atom news: dedupe on guid or id; a news item has no start. */
export function parseFeed(body) {
  const doc = xml.parse(body)
  const rssItems = asArray(doc?.rss?.channel?.item)
  const atomItems = asArray(doc?.feed?.entry)
  const fromRss = rssItems.map((item) => ({
    ownId: collapse(textOf(item.guid)) || collapse(textOf(item.link)),
    url: collapse(textOf(item.link)) || null,
    title: collapse(toSourceText(textOf(item.title))) || 'News',
    text: textOf(item['content:encoded']) || textOf(item.description),
    modified: textOf(item.pubDate) || null,
  }))
  const fromAtom = atomItems.map((entry) => {
    const link = asArray(entry.link).find((l) => !l['@_rel'] || l['@_rel'] === 'alternate')
    return {
      ownId: collapse(textOf(entry.id)),
      url: link?.['@_href'] ?? null,
      title: collapse(toSourceText(textOf(entry.title))) || 'News',
      text: textOf(entry.content) || textOf(entry.summary),
      modified: textOf(entry.updated) || null,
    }
  })
  return [...fromRss, ...fromAtom]
    .filter((item) => item.ownId)
    .map((item) => ({
      ownId: item.ownId,
      kind: 'news',
      title: item.title,
      sourceText: toSourceText(item.text),
      startsAt: null,
      endsAt: null,
      allDay: null,
      locationText: null,
      sourceStatus: 'unknown',
      url: item.url,
      modified: item.modified,
    }))
}

export { parseIcs }

export const PARSERS = {
  'legistar-events': parseLegistarEvents,
  'legistar-matters': parseLegistarMatters,
  // HTML pages with no feed (#390): each page's own markup
  'district16-blog': parseCityArticles,
  'city-news': parseCityArticles,
  'city-public-info-meetings': parseCityEvents,
  'wisdot-i39-90-94': parseWisdotMeetings,
}

/** The parser for a source: by id when it has its own, else by format. HTML needs its own. */
export function parserFor(source) {
  if (PARSERS[source.id]) return PARSERS[source.id]
  if (source.format === 'ics') return parseIcs
  if (source.format === 'rss' || source.format === 'atom') return parseFeed
  return null
}
