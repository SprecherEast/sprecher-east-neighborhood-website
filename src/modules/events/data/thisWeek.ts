import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { OFFICIAL_BODIES } from '../domain/officialMeetings'
import type { ThisWeekSource } from '../domain/thisWeek'
import type { EventSummary } from '../domain/types'
import { inListing } from './listing'
import { SUMMARY_FIELDS, toEventSummary } from './mappers'

const OFFICIAL_BODY_VALUES = OFFICIAL_BODIES.map(({ value }) => value)

/**
 * One row's events: published events dated from `today` up to, not including, `until`, soonest
 * first, at most `limit`; official meetings only for `official`, and only category `categoryId`'s
 * events for `category`. It uses the listing's own filter (`inListing`), so a row never shows what
 * /events wouldn't; cancelled events stay, with their label. Plain arguments, so a use case can
 * cache it per request.
 */
export async function findEventsInWindow(
  today: string,
  until: string,
  source: ThisWeekSource,
  limit: number,
  categoryId?: number,
): Promise<EventSummary[]> {
  // A category row needs its category: without one it lists nothing rather than everything
  if (source === 'category' && categoryId === undefined) return []
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'events',
    depth: 1,
    limit,
    sort: ['date', 'id'],
    overrideAccess: false,
    where: {
      and: [
        inListing('upcoming', today, source === 'category' ? categoryId : undefined),
        { date: { less_than: until } },
        // A known body, as `isOfficialBody` reads it, so the row and the card's label agree
        ...(source === 'official' ? [{ officialBody: { in: OFFICIAL_BODY_VALUES } }] : []),
      ],
    },
    select: SUMMARY_FIELDS,
  })

  return docs.map(toEventSummary)
}
