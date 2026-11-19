import type { EventSummary } from './types'

/*
 * The "this week" strip (#122): a page-builder block that shows the next few days of events in
 * rows, such as "Coming up", "Civic and official" and "Family". Its block config is in
 * `cms/eventsThisWeekBlock.ts`; the mapper `toEventsThisWeekProps` builds these props.
 */

/** The bounds editors may set, shared by the block's fields and the use case. */
export const THIS_WEEK_LIMITS = {
  days: { min: 1, max: 31, default: 7 },
  rows: { max: 4 },
  limit: { min: 1, max: 6, default: 3 },
} as const

export const THIS_WEEK_DEFAULT_HEADING = 'This week in Sprecher East'

/**
 * Which events a row lists: every upcoming event in the window, the official meetings
 * (`officialBody` set), or one category's events.
 */
export const THIS_WEEK_SOURCES = ['all', 'official', 'category'] as const

export type ThisWeekSource = (typeof THIS_WEEK_SOURCES)[number]

/** What the empty strip says when no row has an event. */
export const THIS_WEEK_EMPTY_MESSAGE = 'Nothing on the calendar this week.'

/** One row of the strip: its title, its events, and where its "See all" link goes. */
export type EventsThisWeekRow = {
  title: string
  events: EventSummary[]
  seeAll: { href: string; label: string }
}

/**
 * The strip as it draws: the rows that have events, in the editor's order. No rows means the
 * empty state, with the link to every event.
 */
export type EventsThisWeekProps = {
  id?: string
  heading: string
  rows: EventsThisWeekRow[]
  allEventsHref: string
}

const DAY_MS = 86_400_000

/** `value` as a whole number within `min` and `max`, or `fallback` when it isn't a number. */
export function clampWhole(
  value: number | null | undefined,
  { min, max, default: fallback }: { min: number; max: number; default: number },
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * The end of the window, exclusive: `days` days after `today`, so `days` 7 holds today and the six
 * days after it. `today` is the site-timezone date as midnight UTC (`startOfToday()`), the way
 * event dates are stored, so adding whole days never crosses a timezone boundary.
 */
export function windowEnd(today: string, days: number): string {
  return new Date(Date.parse(today) + days * DAY_MS).toISOString()
}
