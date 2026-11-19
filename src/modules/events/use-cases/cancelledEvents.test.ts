import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

import type * as Queries from '../data/queries'
import type { findEventPage as FindEventPage } from './findEventPage'
import type { findEventsAfter as FindEventsAfter } from './findEventsAfter'
import type { findUpcomingEvents as FindUpcomingEvents } from './findUpcomingEvents'

// Loaded after Payload boots: the config reads its environment when it is imported
let queries: typeof Queries
let findEventPage: typeof FindEventPage
let findEventsAfter: typeof FindEventsAfter
let findUpcomingEvents: typeof FindUpcomingEvents

/**
 * A cancelled event is never silently removed (#122): it stays in the upcoming and past
 * listings, their counts, "Load more" and the sidebar, and its page still opens, each marked as cancelled.
 * Payload runs on an in-memory SQLite database: no file, no network.
 */

const event = (slug: string, date: string, cancelled: boolean) => ({
  title: slug,
  slug,
  date,
  cancelled,
  _status: 'published' as const,
})

beforeAll(async () => {
  const { payload } = await bootPayload()
  queries = await import('../data/queries')
  ;({ findEventPage } = await import('./findEventPage'))
  ;({ findEventsAfter } = await import('./findEventsAfter'))
  ;({ findUpcomingEvents } = await import('./findUpcomingEvents'))
  // Far from today either way, so the test doesn't depend on the clock
  for (const data of [
    event('picnic-called-off', '2099-06-01T00:00:00.000Z', true),
    event('picnic', '2099-06-02T00:00:00.000Z', false),
    event('old-fair-called-off', '2001-06-01T00:00:00.000Z', true),
    event('old-fair', '2001-06-02T00:00:00.000Z', false),
  ]) {
    await payload.create({
      collection: 'events',
      data,
      context: NO_REVALIDATE,
      overrideAccess: true,
    })
  }
}, 60_000)

const cancelledBySlug = (docs: { slug: string; cancelled: boolean }[]) =>
  Object.fromEntries(docs.map(({ slug, cancelled }) => [slug, cancelled]))

describe('cancelled events (#122)', () => {
  it('stay in the upcoming listing and its count, marked as cancelled', async () => {
    const page = await findEventPage('upcoming', 1)

    expect(cancelledBySlug(page.docs)).toEqual({ 'picnic-called-off': true, picnic: false })
    expect(page.totalDocs).toBe(2)
  })

  it('stay in the past listing and its count, marked as cancelled', async () => {
    const page = await findEventPage('past', 1)

    expect(cancelledBySlug(page.docs)).toEqual({ 'old-fair': false, 'old-fair-called-off': true })
    expect(page.totalDocs).toBe(2)
  })

  it('come back from "Load more", marked as cancelled', async () => {
    // Past runs newest first: the cancelled fair comes after the one that went ahead
    const [first] = (await findEventPage('past', 1)).docs
    expect(first?.slug).toBe('old-fair')
    if (!first) return

    const more = await findEventsAfter('past', { key: first.date, id: first.id })

    expect(cancelledBySlug(more.docs)).toEqual({ 'old-fair-called-off': true })
    expect(more.totalDocs).toBe(2)
  })

  it('stay in the upcoming sidebar', async () => {
    expect(cancelledBySlug(await findUpcomingEvents())).toEqual({
      'picnic-called-off': true,
      picnic: false,
    })
  })

  it('keep their own page, marked as cancelled', async () => {
    // The query itself: the use case reads draft mode, which needs a request
    const page = await queries.getEventBySlug('picnic-called-off', { draft: false })
    expect(page?.cancelled).toBe(true)
  })
})
