import type { EventScope } from './scope'

/**
 * Filtering /events by category (#122). The filters are the categories that have published events,
 * read from the CMS; each one is a page of its own, `/events/category/<slug>`, so a filter is a
 * plain link that works without JavaScript and every filtered view is cached like /events.
 */

/** How many published events a listing holds in each scope. */
export type EventCounts = Record<EventScope, number>

/** A category /events can be filtered by, with how many published events it has. */
export type EventCategoryFilter = {
  id: number
  slug: string
  title: string
  counts: EventCounts
}

/** The filter row: every category with published events, and the counts without a filter. */
export type EventFilterMenu = {
  all: EventCounts
  categories: EventCategoryFilter[]
}

/** Longest category slug a URL or a client request may carry: a sanity bound, as `MAX_PAGE` is. */
const MAX_SLUG_LENGTH = 64

/**
 * Whether `value` has the shape of a category slug: what Payload's `slugify` writes (lower-case
 * letters, digits, `-` and `_`), at most 64 characters. It's the check before any lookup; only a
 * slug of an existing category ever reaches a query, as that category's id.
 */
export function isCategorySlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && /^[a-z0-9_-]+$/.test(value)
}

/** The category with `slug` among `filters`, or `null` when no listed category has it. */
export function findFilter(
  filters: readonly EventCategoryFilter[],
  slug: unknown,
): EventCategoryFilter | null {
  if (!isCategorySlug(slug)) return null
  return filters.find((filter) => filter.slug === slug) ?? null
}

/** /events, or the page of one category. */
export function eventsHref(categorySlug?: string | null): string {
  return categorySlug ? `/events/category/${categorySlug}` : '/events'
}

/** A numbered no-JavaScript page of a listing, inside a category's pages when one is given. */
export function eventsListHref(
  scope: EventScope,
  page: number,
  categorySlug?: string | null,
): string {
  return categorySlug
    ? `/events/category/${categorySlug}/list/${scope}/${page}`
    : `/events/list/${scope}/${page}`
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * What the filter row says and announces: "Showing 9 Civic events: 4 upcoming and 5 past", or
 * without a category "Showing all 20 events: 8 upcoming and 12 past".
 */
export function describeEventCounts(categoryTitle: string | null, counts: EventCounts): string {
  const noun = categoryTitle ? `${categoryTitle} event` : 'event'
  const total = plural(counts.upcoming + counts.past, noun, `${noun}s`)
  const split = `${counts.upcoming} upcoming and ${counts.past} past`
  return categoryTitle ? `Showing ${total}: ${split}` : `Showing all ${total}: ${split}`
}

/** The heading of a no-JavaScript list page: "Upcoming Events", "Past Civic Events". */
export function eventListTitle(scope: EventScope, categoryTitle?: string | null): string {
  const when = scope === 'upcoming' ? 'Upcoming' : 'Past'
  return categoryTitle ? `${when} ${categoryTitle} Events` : `${when} Events`
}
