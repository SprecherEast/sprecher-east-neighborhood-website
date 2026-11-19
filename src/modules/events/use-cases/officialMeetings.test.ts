import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

import type * as Queries from '../data/queries'
import type { findEventPage as FindEventPage } from './findEventPage'
import type { findUpcomingEvents as FindUpcomingEvents } from './findUpcomingEvents'

// Loaded after Payload boots: the config reads its environment when it is imported
let queries: typeof Queries
let findEventPage: typeof FindEventPage
let findUpcomingEvents: typeof FindUpcomingEvents
let payload: Awaited<ReturnType<typeof bootPayload>>['payload']

/**
 * An official meeting's body and agenda link go through Payload and come back on the cards,
 * the sidebar and its own page (#122), and Payload refuses an agenda link that isn't https.
 * Payload runs on an in-memory SQLite database: no file, no network.
 */

const AGENDA = 'https://madison.legistar.com/Calendar.aspx'

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('../data/queries')
  ;({ findEventPage } = await import('./findEventPage'))
  ;({ findUpcomingEvents } = await import('./findUpcomingEvents'))
  // Far in the future, so the test doesn't depend on the clock
  for (const data of [
    { slug: 'council', officialBody: 'city' as const, agendaUrl: AGENDA },
    { slug: 'potluck', officialBody: null, agendaUrl: null },
  ]) {
    await payload.create({
      collection: 'events',
      data: { ...data, title: data.slug, date: '2099-06-01T00:00:00.000Z', _status: 'published' },
      context: NO_REVALIDATE,
      overrideAccess: true,
    })
  }
}, 60_000)

const bodyBySlug = (docs: { slug: string; officialBody: string | null }[]) =>
  Object.fromEntries(docs.map(({ slug, officialBody }) => [slug, officialBody]))

describe('official meetings (#122)', () => {
  it('carry their body to the upcoming listing and the sidebar', async () => {
    expect(bodyBySlug((await findEventPage('upcoming', 1)).docs)).toEqual({
      council: 'city',
      potluck: null,
    })
    expect(bodyBySlug(await findUpcomingEvents())).toEqual({ council: 'city', potluck: null })
  })

  it('carry their body and agenda link to their own page', async () => {
    const council = await queries.getEventBySlug('council', { draft: false })
    expect(council).toMatchObject({ officialBody: 'city', agendaUrl: AGENDA })

    const potluck = await queries.getEventBySlug('potluck', { draft: false })
    expect(potluck).toMatchObject({ officialBody: null, agendaUrl: null })
  })

  it.each(['http://madison.legistar.com/Calendar.aspx', 'javascript:alert(1)', '/agenda'])(
    'refuse the agenda link %s',
    async (agendaUrl) => {
      await expect(
        payload.create({
          collection: 'events',
          data: {
            title: 'Bad agenda',
            slug: `bad-${encodeURIComponent(agendaUrl)}`,
            date: '2099-06-02T00:00:00.000Z',
            officialBody: 'county',
            agendaUrl,
          },
          context: NO_REVALIDATE,
          overrideAccess: true,
        }),
      ).rejects.toThrow(/agenda/i)
    },
  )
})
