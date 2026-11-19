import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { isCategorySlug, type EventCounts, type EventFilterMenu } from '../domain/filters'
import { EVENT_SCOPES, type EventScope } from '../domain/scope'
import { inListing } from './listing'

/** How many events of each scope each category id has. */
function tally(byScope: Record<EventScope, (number | { id: number })[][]>) {
  const counts = new Map<number, EventCounts>()
  for (const scope of EVENT_SCOPES) {
    for (const categories of byScope[scope]) {
      for (const category of categories) {
        const id = typeof category === 'object' ? category.id : category
        const entry = counts.get(id) ?? { upcoming: 0, past: 0 }
        entry[scope] += 1
        counts.set(id, entry)
      }
    }
  }
  return counts
}

/**
 * The id of the category with `slug`, or `null` when there is none: one indexed read, for the
 * "Load more" action, which must not rebuild the whole filter row on every click (#122).
 */
export async function findCategoryIdBySlug(slug: string): Promise<number | null> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: false,
    where: { slug: { equals: slug } },
    select: { slug: true },
  })
  return docs[0]?.id ?? null
}

/**
 * The filter row of /events (#122): the categories at least one published event has, upcoming or
 * past, sorted by title, with their counts, and the counts of the whole listing. The scopes use the
 * listing's own filter (`inListing`), so the counts match the lists. Events share the category tree
 * with posts (#362); a category only posts use isn't offered. A category whose slug doesn't fit
 * `isCategorySlug` (one typed by hand) is left out, since its page couldn't be addressed.
 */
export async function findEventFilterMenu(today: string): Promise<EventFilterMenu> {
  const payload = await getPayload({ config: configPromise })

  // Every published event's category ids, per scope: the listing is small (a neighborhood's
  // events), and the ids alone are read
  const categoriesIn = async (scope: EventScope) => {
    const { docs } = await payload.find({
      collection: 'events',
      depth: 0,
      pagination: false,
      overrideAccess: false,
      where: inListing(scope, today),
      select: { categories: true },
    })
    return docs.map((doc) => doc.categories ?? [])
  }
  const [upcoming, past] = await Promise.all([categoriesIn('upcoming'), categoriesIn('past')])
  const all = { upcoming: upcoming.length, past: past.length }
  const counts = tally({ upcoming, past })
  if (counts.size === 0) return { all, categories: [] }

  const categories = await payload.find({
    collection: 'categories',
    depth: 0,
    pagination: false,
    overrideAccess: false,
    sort: 'title',
    where: { id: { in: [...counts.keys()] } },
    select: { title: true, slug: true },
  })

  return {
    all,
    categories: categories.docs.flatMap(({ id, slug, title }) => {
      const found = counts.get(id)
      return found && isCategorySlug(slug)
        ? [{ id, slug, title: title || 'Untitled category', counts: found }]
        : []
    }),
  }
}
