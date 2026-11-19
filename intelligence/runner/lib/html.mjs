import { load } from 'cheerio'

import { collapse, toSourceText } from './text.mjs'
import { addDays, parseClock, zonedIso } from './time.mjs'

// Parsers for the sources that publish no feed, only an HTML page (#390). Each reads the page's
// own list markup, as captured on 2026-10-27, and answers raw items in the same shape as the feed
// parsers (parsers.mjs). A page whose markup changes yields no items, never guessed ones: scout
// then records zero candidates, which the run log shows. Items already past (`from`, today's date
// in the site's timezone) are left out, so they never cost a model call.

/** How far back a news post counts as new: older posts on the page are left out. */
export const NEWS_DAYS = 14

/** An absolute https URL for a link on the page's own site, or null. */
function onSite(href, base) {
  if (!href) return null
  try {
    const url = new URL(href, base)
    const site = (host) => host.replace(/^www\./, '')
    return url.protocol === 'https:' && site(url.hostname) === site(new URL(base).hostname)
      ? url.href
      : null
  } catch {
    return null
  }
}

/** A cancellation, rescheduling or postponement named in the title or a tag. */
function statusOf(...texts) {
  const all = texts.filter(Boolean).join(' ')
  if (/cancel/i.test(all)) return 'cancelled'
  if (/reschedul|postpon/i.test(all)) return 'rescheduled'
  return 'scheduled'
}

/**
 * City of Madison article lists: the District 16 alder's blog and City news. Each post is an
 * `.article-summary` with its title link, a `time[datetime]` for when it was posted, and a
 * summary. A post is news: it has no start of its own, and verify reads any meeting it announces
 * from the text. Posts older than NEWS_DAYS are left out, and so is a post without a posted date:
 * the list always shows one, so a post without it isn't one the parser understands.
 */
export function parseCityArticles(body, { base, from }) {
  const $ = load(body)
  const oldest = from ? addDays(from, -NEWS_DAYS) : null
  return $('.article-summary')
    .toArray()
    .map((el) => {
      const post = $(el)
      const link = post.find('.article-title a').first()
      const url = onSite(link.attr('href'), base)
      return {
        ownId: url ? new URL(url).pathname : null,
        kind: 'news',
        title: collapse(link.text()) || 'News',
        sourceText: toSourceText(post.find('.article-content').html() ?? ''),
        startsAt: null,
        endsAt: null,
        allDay: null,
        locationText: null,
        sourceStatus: 'unknown',
        url,
        modified: post.find('time[datetime]').first().attr('datetime') ?? null,
      }
    })
    .filter((item) => item.ownId && !(oldest && (item.modified ?? '').slice(0, 10) < oldest))
}

/**
 * The City's public information meetings: each event has its title link, a start and an end as
 * `time[datetime]` (local time with the offset), its venue ("Virtual event" or a named address),
 * and sometimes a tag ("Full", or a cancellation). Meetings that ended before today are left out.
 */
export function parseCityEvents(body, { base, from }) {
  const $ = load(body)
  return $('.event-heading')
    .toArray()
    .map((el) => {
      const event = $(el).closest('li')
      const link = $(el).find('a').first()
      const url = onSite(link.attr('href'), base)
      const when = event.find('.field-smart-date--standard')
      const startsAt = when.find('time.start-date').attr('datetime') ?? null
      const endsAt = when.find('time.end-date').attr('datetime') ?? null
      const title = collapse(link.text()) || 'Public information meeting'
      const tag = collapse(event.find('.tag').text())
      const venue = collapse(event.find('.event-venues').text())
      return {
        ownId: url ? `${new URL(url).pathname}@${startsAt ?? ''}` : null,
        kind: 'meeting',
        title,
        sourceText: toSourceText([tag && `Tag: ${tag}`, venue].filter(Boolean).join('. ')),
        startsAt,
        endsAt,
        allDay: startsAt ? false : null,
        locationText: venue || null,
        sourceStatus: statusOf(title, tag),
        url,
        modified: null,
      }
    })
    .filter((item) => {
      const last = item.endsAt ?? item.startsAt
      return item.ownId && !(from && last && last.slice(0, 10) < from)
    })
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

/** "november 10, 2026" or "august 2026" as year, month and (when given) day; else null. */
function dateOf(text) {
  const match = /^([a-z]+)\s+(?:(\d{1,2}),\s*)?(\d{4})$/i.exec(collapse(text))
  const month = match ? MONTHS.indexOf(match[1].toLowerCase()) + 1 : 0
  if (!month) return null
  return { year: +match[3], month, day: match[2] ? +match[2] : null }
}

const pad = (n) => String(n).padStart(2, '0')

/** The last day a date can be, as `YYYY-MM-DD`: the day itself, or a month's last day. */
const lastDayOf = ({ year, month, day }) =>
  day
    ? `${year}-${pad(month)}-${pad(day)}`
    : addDays(`${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01`, -1)

const CLOCK = String.raw`(\d{1,2}(?::\d{2})?)`
const MERIDIEM = String.raw`([ap])\.?\s*m\b\.?`
// "5 to 7 p.m.", "5:30-7 p.m.": the start borrows the end's a.m. or p.m. when it has none
const RANGE = new RegExp(
  String.raw`\b${CLOCK}\s*(?:${MERIDIEM})?\s*(?:to|-|–)\s*${CLOCK}\s*${MERIDIEM}`,
  'i',
)
const SINGLE = new RegExp(String.raw`\b${CLOCK}\s*${MERIDIEM}`, 'i')

/**
 * The first clock time in a text ("5:30 p.m.", "6 PM", "noon"), or a range's start, as hours
 * and minutes. A range's start without a.m. or p.m. borrows the end's, unless that would put it
 * after the end ("11 to 1 p.m." starts at 11 a.m.).
 */
export function clockIn(text) {
  const plain = String(text).replace(/\bnoon\b/gi, '12 p.m.')
  const range = RANGE.exec(plain)
  if (range) {
    const end = parseClock(`${range[3]} ${range[4]}m`)
    const start = parseClock(`${range[1]} ${range[2] ?? range[4]}m`)
    if (start && end && !range[2] && start.hour > end.hour) {
      return { ...start, hour: start.hour - 12 }
    }
    return start
  }
  const single = SINGLE.exec(plain)
  return single ? parseClock(`${single[1]} ${single[2]}m`) : null
}

/**
 * The time the page gives elsewhere for a day, as in "on November 10, 2026, at 5:30 p.m.", used
 * only when exactly one sentence on the page says it: two times for one day could be two events.
 */
function clockOnPage(pageText, { year, month, day }) {
  const name = MONTHS[month - 1]
  const said = new RegExp(
    String.raw`\b${name}\s+${day},\s*${year},?\s+at\s+${CLOCK}\s*${MERIDIEM}`,
    'gi',
  )
  const matches = [...pageText.matchAll(said)]
  return matches.length === 1 ? parseClock(`${matches[0][1]} ${matches[0][2]}m`) : null
}

/**
 * WisDOT's I-39/90/94 project meetings: each is a box with its date as a heading ("november 10,
 * 2026", or only a month for older ones), a title and a description. The time comes from the
 * description, or from another place on the page that names the same day ("on November 10,
 * 2026, at 5:30 p.m."); with neither, the date goes in the text for verify to see. Meetings
 * before today are left out. Every meeting links to the page, which has no page per meeting.
 */
export function parseWisdotMeetings(body, { base, from }) {
  const $ = load(body)
  const pageText = collapse($('body').text())
  // Each box's day as `YYYY-MM-DD` (or its text when it has no day), so two boxes that write the
  // same day differently still count as one day
  const dayKey = (text) => {
    const date = dateOf(text)
    return date?.day ? lastDayOf(date) : collapse(text).toLowerCase()
  }
  const boxDays = $('.subhead-small-pim')
    .toArray()
    .map((el) => dayKey($(el).text()))
  return $('.subhead-small-pim')
    .toArray()
    .map((el) => {
      const box = $(el).parent()
      const dateText = collapse($(el).text())
      const title = collapse(box.find('h1, h2, h3').not('.subhead-small-pim').first().text())
      const text = toSourceText(
        box
          .find('p')
          .toArray()
          .map((p) => $(p).html() ?? '')
          .join('\n'),
      )
      // An empty placeholder box (no title, no text) isn't a meeting
      if (!title && !text) return null
      const date = dateOf(dateText)
      if (date && from && lastDayOf(date) < from) return null
      // The page's own sentence counts only when no other box has the same day
      const onlyBox = boxDays.filter((d) => d === dayKey(dateText)).length === 1
      const clock = date?.day
        ? (clockIn(text) ?? (onlyBox ? clockOnPage(pageText, date) : null))
        : null
      const startsAt = clock ? zonedIso({ ...date, ...clock }) : null
      const dateNote = startsAt
        ? null
        : `Date given as "${dateText}"; the page's listing gives no time`
      return {
        // A dated meeting's id is its day, so a retitled meeting stays the same item; the title is
        // added below only when two meetings share a day, or the date has no day. Accepted: when
        // a second meeting joins a day, the first one's id changes and it comes back once as new
        ownId: date?.day ? lastDayOf(date) : slugOf(`${dateText} ${title}`),
        kind: 'meeting',
        title: title || 'Public meeting',
        sourceText: toSourceText([dateNote, text].filter(Boolean).join('. ')),
        startsAt,
        endsAt: null,
        allDay: startsAt ? false : null,
        locationText: /virtual/i.test(`${title} ${text}`) ? 'Virtual meeting' : null,
        sourceStatus: statusOf(title),
        url: base,
        modified: null,
      }
    })
    .filter((item) => item?.ownId)
    .map((item, _, all) =>
      all.filter((other) => other.ownId === item.ownId).length > 1
        ? { ...item, ownId: `${item.ownId}-${slugOf(item.title)}` }
        : item,
    )
}

const slugOf = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
