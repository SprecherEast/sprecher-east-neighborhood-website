import 'server-only'

import type { Event, EventsThisWeekBlock } from '@/payload-types'
import { toBandBackdrop } from '@/platform/payload/bandBackdrop'
import { toImageRef } from '@/platform/payload/imageRef'

import type { EventCategoryRef } from '../domain/categories'
import { eventsHref, isCategorySlug } from '../domain/filters'
import { toMapsHref } from '../domain/maps'
import { isAgendaUrl, isOfficialBody } from '../domain/officialMeetings'
import { eventPlace } from '../domain/place'
import {
  clampWhole,
  THIS_WEEK_DEFAULT_HEADING,
  THIS_WEEK_LIMITS,
  type EventsThisWeekProps,
  type EventsThisWeekRow,
  type ThisWeekSource,
} from '../domain/thisWeek'
import type { EventDetail, EventSummary } from '../domain/types'

/** The fields `toEventSummary` reads; queries for summaries select exactly these. */
export const SUMMARY_FIELDS = {
  title: true,
  slug: true,
  date: true,
  timeStart: true,
  timeEnd: true,
  cancelled: true,
  officialBody: true,
  categories: true,
  description: true,
  locationName: true,
  locationType: true,
  heroImage: true,
} as const

type SummaryDoc = Pick<Event, 'id' | keyof typeof SUMMARY_FIELDS>

/** The loaded categories; a category that is only an id (not loaded) is left out. */
function toCategories(values: Event['categories']): EventCategoryRef[] {
  return (values ?? []).flatMap((category) =>
    typeof category === 'object' && category !== null
      ? [{ id: category.id, title: category.title || 'Untitled category' }]
      : [],
  )
}

/** An event document as a card or list item shows it. */
export function toEventSummary(doc: SummaryDoc): EventSummary {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    date: doc.date,
    timeStart: doc.timeStart ?? null,
    timeEnd: doc.timeEnd ?? null,
    cancelled: doc.cancelled === true,
    officialBody: isOfficialBody(doc.officialBody) ? doc.officialBody : null,
    categories: toCategories(doc.categories),
    description: doc.description ?? null,
    locationName: doc.locationName ?? null,
    place: eventPlace({ locationType: doc.locationType ?? null, locationName: doc.locationName ?? null }),
    image: toImageRef(doc.heroImage),
  }
}

/** An event document as its own page shows it. */
export function toEventDetail(doc: Event): EventDetail {
  const locationAddress = doc.locationAddress ?? null
  const summary = toEventSummary(doc)
  return {
    ...summary,
    place: eventPlace({
      locationType: doc.locationType ?? null,
      locationName: summary.locationName,
      locationAddress,
    }),
    locationType: doc.locationType ?? null,
    locationAddress,
    mapsHref: toMapsHref(doc.mapsUrl ?? null, locationAddress),
    registrationUrl: doc.registrationUrl ?? null,
    // Only an official meeting has an agenda; a link left behind when the body was cleared, or
    // one stored before the field was checked, is dropped rather than shown
    agendaUrl: summary.officialBody && isAgendaUrl(doc.agendaUrl) ? doc.agendaUrl : null,
    content: doc.content ?? null,
    backdrop: toBandBackdrop(doc.backdrop),
    meta: {
      title: doc.meta?.title ?? null,
      description: doc.meta?.description ?? null,
      image: toImageRef(doc.meta?.image),
    },
  }
}

/** What one row of the "this week" strip asks for (#122). */
export type WindowRowQuery =
  | { source: Exclude<ThisWeekSource, 'category'>; limit: number }
  | { source: 'category'; categoryId: number; limit: number }

/** The stored "this week" block as the use case reads it: its heading, days and rows (#617). */
export type StoredEventsThisWeekBlock = Pick<
  EventsThisWeekBlock,
  'id' | 'heading' | 'days' | 'rows'
>

type StoredRow = EventsThisWeekBlock['rows'][number]

/**
 * What a stored row asks for, with its limit kept within bounds, or `null` for a category row
 * whose category is gone or was never picked: it lists nothing, so it is hidden.
 */
export function toWindowRowQuery({ source, category, limit }: StoredRow): WindowRowQuery | null {
  const bounded = clampWhole(limit, THIS_WEEK_LIMITS.limit)
  if (source !== 'category') return { source, limit: bounded }
  const categoryId = typeof category === 'object' ? category?.id : category
  return typeof categoryId === 'number' ? { source, categoryId, limit: bounded } : null
}

const SEE_ALL_EVENTS = { href: eventsHref(), label: 'See all events' }

/** Where a row's "See all" goes: its category's page, or /events for every other row. */
function toSeeAll({ source, category }: StoredRow) {
  if (source !== 'category' || typeof category !== 'object' || !category) return { ...SEE_ALL_EVENTS }
  if (!isCategorySlug(category.slug)) return { ...SEE_ALL_EVENTS }
  const title = category.title || 'Untitled category'
  return { href: eventsHref(category.slug), label: `See all ${title} events` }
}

/**
 * The "this week" strip as it draws (#122), from the stored block and each row's events, in the
 * rows' order. A row with no events is left out; with none left, the strip shows its empty state.
 */
export function toEventsThisWeekProps(
  { id, heading, rows }: Pick<StoredEventsThisWeekBlock, 'id' | 'heading' | 'rows'>,
  eventsByRow: readonly (readonly EventSummary[])[],
): EventsThisWeekProps {
  return {
    ...(id && { id }),
    heading: heading?.trim() || THIS_WEEK_DEFAULT_HEADING,
    rows: (rows ?? []).flatMap((row, index): EventsThisWeekRow[] => {
      const events = eventsByRow[index] ?? []
      return events.length > 0
        ? [{ title: row.title, events: [...events], seeAll: toSeeAll(row) }]
        : []
    }),
    allEventsHref: SEE_ALL_EVENTS.href,
  }
}
