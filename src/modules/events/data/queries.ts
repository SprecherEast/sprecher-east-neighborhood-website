import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { cursorAfterLast, type FeedMore, type FeedPage, type SortCursor } from '@/platform/lib'
import { afterCursor, keysetSort } from '@/platform/payload/keyset'
import { PUBLISHED } from '@/platform/payload/published'

import { EVENT_SCOPE_ORDER, type EventScope } from '../domain/scope'
import type { EventDetail, EventSitemapEntry, EventSummary } from '../domain/types'
import { inListing } from './listing'
import { SUMMARY_FIELDS, toEventDetail, toEventSummary } from './mappers'
import { inScope } from './scope'

/** Events per page in each listing, numbered pages and "Load more" alike. */
const PAGE_SIZE: Record<EventScope, number> = { upcoming: 12, past: 9 }

/**
 * One page of a listing, sorted by date with the id as tie-break (#125), so equal dates keep one
 * order across pages: page `page`, or the page after `after`. With `categoryId`, only the events
 * in that category (#122).
 */
async function findListingPage(
  scope: EventScope,
  today: string,
  { page, after, categoryId }: { page?: number; after?: SortCursor; categoryId?: number },
) {
  const payload = await getPayload({ config: configPromise })
  const order = EVENT_SCOPE_ORDER[scope]
  const where = inListing(scope, today, categoryId)

  const result = await payload.find({
    collection: 'events',
    depth: 1,
    limit: PAGE_SIZE[scope],
    page,
    sort: keysetSort('date', order),
    overrideAccess: false,
    where: after ? { and: [where, afterCursor('date', order, after)] } : where,
    select: SUMMARY_FIELDS,
  })

  return {
    ...result,
    docs: result.docs.map(toEventSummary),
    nextCursor: cursorAfterLast(result.docs, (doc) => doc.date, result.hasNextPage),
  }
}

/**
 * One numbered page of published upcoming events (soonest first) or past events (most recent
 * first), for the first page and the no-JavaScript pages, in one category when `categoryId` is
 * given. `today` is the site-timezone date as midnight UTC (`startOfToday()`).
 */
export async function findEventPage(
  scope: EventScope,
  page: number,
  today: string,
  categoryId?: number,
): Promise<FeedPage<EventSummary>> {
  const result = await findListingPage(scope, today, { page, categoryId })

  return {
    docs: result.docs,
    page: result.page ?? page,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
    limit: PAGE_SIZE[scope],
    nextCursor: result.nextCursor,
  }
}

/**
 * The events of a listing after `cursor` ("Load more"). Asking for what comes after the last
 * item shown, not for page n, means an item removed in between skips nothing (#125).
 */
export async function findEventsAfter(
  scope: EventScope,
  cursor: SortCursor,
  today: string,
  categoryId?: number,
): Promise<FeedMore<EventSummary>> {
  const payload = await getPayload({ config: configPromise })
  const [result, total] = await Promise.all([
    findListingPage(scope, today, { after: cursor, categoryId }),
    payload.count({
      collection: 'events',
      overrideAccess: false,
      where: inListing(scope, today, categoryId),
    }),
  ])

  return { docs: result.docs, nextCursor: result.nextCursor, totalDocs: total.totalDocs }
}

/** The next published upcoming events, soonest first, leaving out `excludeId` if given. */
export async function findUpcomingEvents({
  today,
  limit,
  excludeId,
}: {
  today: string
  limit: number
  excludeId?: number
}): Promise<EventSummary[]> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'events',
    depth: 1,
    limit,
    sort: 'date',
    overrideAccess: false,
    where: {
      and: [
        PUBLISHED,
        inScope('upcoming', today),
        ...(excludeId === undefined ? [] : [{ id: { not_equals: excludeId } }]),
      ],
    },
    select: SUMMARY_FIELDS,
  })

  return result.docs.map(toEventSummary)
}

/**
 * The event at `slug`, or `null`. With `draft`, the latest draft, read past access control so
 * editors can preview it; otherwise only what a visitor may see.
 */
export async function getEventBySlug(
  slug: string,
  { draft }: { draft: boolean },
): Promise<EventDetail | null> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'events',
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: { slug: { equals: slug } },
  })

  const doc = result.docs[0]
  return doc ? toEventDetail(doc) : null
}

/** Every published event's slug and last edit. */
export async function listEventSlugs(): Promise<EventSitemapEntry[]> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'events',
    draft: false,
    depth: 0,
    limit: 1000,
    pagination: false,
    overrideAccess: false,
    where: PUBLISHED,
    select: { slug: true, updatedAt: true },
  })

  return result.docs.map(({ slug, updatedAt }) => ({ slug, updatedAt }))
}
