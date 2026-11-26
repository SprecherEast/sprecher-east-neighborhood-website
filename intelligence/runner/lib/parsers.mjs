import { parseFeed } from './feed.mjs'
import { collapse, toSourceText } from './text.mjs'
import {
  parseCityArticles,
  parseCityEvents,
  parseParkStatus,
  parseParksEvents,
  parseWisdotMeetings,
} from './html.mjs'
import { parseIcs } from './ics.mjs'
import { parseIncidentReports } from './incidents.mjs'
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

export { parseFeed, parseIcs }

export const PARSERS = {
  'legistar-events': parseLegistarEvents,
  'legistar-matters': parseLegistarMatters,
  // HTML pages with no feed (#390): each page's own markup
  'district16-blog': parseCityArticles,
  'city-news': parseCityArticles,
  'city-public-info-meetings': parseCityEvents,
  'wisdot-i39-90-94': parseWisdotMeetings,
  // Park and community pages (#995)
  'madison-parks-events': parseParksEvents,
  'mpo-events': parseCityEvents,
  'alder-weekly-roundups': parseCityArticles,
  'door-creek-park-ski': parseParkStatus,
  'door-creek-park-ice': parseParkStatus,
  // The police feed's own layout: the block address, and the report's page as its identity (#993)
  'madison-police-incident-reports': parseIncidentReports,
}

/** The parser for a source: by id when it has its own, else by format. HTML needs its own. */
export function parserFor(source) {
  if (PARSERS[source.id]) return PARSERS[source.id]
  if (source.format === 'ics') return parseIcs
  if (source.format === 'rss' || source.format === 'atom') return parseFeed
  return null
}
