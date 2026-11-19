import { expect } from 'vitest'

import type { FeedMore, FeedPage } from '@/platform/lib'

type Listed = { id: number }

/** What a reader received: every id in order, repeats included, and the first page's ids. */
export type Reading = { ids: number[]; onScreen: number[] }

/**
 * Reads a listing to its end as "Load more" does (#125): the first numbered page, then the items
 * after each cursor. `between` runs after the first page, while the reader is looking at it, and
 * may change content.
 */
export async function readListing({
  first,
  after,
  between,
}: {
  first: () => Promise<FeedPage<Listed>>
  after: (cursor: string) => Promise<FeedMore<Listed>>
  between?: (onScreen: number[]) => Promise<void>
}): Promise<Reading> {
  const page = await first()
  const onScreen = page.docs.map((doc) => doc.id)
  const ids = [...onScreen]
  await between?.(onScreen)

  let cursor = page.nextCursor
  // A bound, so a cursor that never advances fails the test instead of hanging it
  for (let loads = 0; cursor !== null; loads++) {
    if (loads > 100) throw new Error('The listing never ended')
    const next = await after(cursor)
    ids.push(...next.docs.map((doc) => doc.id))
    cursor = next.nextCursor
  }
  return { ids, onScreen }
}

/**
 * The reader saw every item the listing now holds, once each and in its order: nothing skipped,
 * nothing repeated, and nothing the listing doesn't hold (a draft, or an event from the other
 * list) except what was already on screen when content changed. `changed` (the item edited
 * between loads) is left out: it may show where it was and again where it went, and the client
 * drops the repeat.
 */
export function expectEveryItemOnce(read: Reading, listing: number[], changed?: number) {
  const others = (ids: number[]) => ids.filter((id) => id !== changed)
  const seen = others(read.ids)
  expect(new Set(seen).size, 'an item was repeated').toBe(seen.length)
  const extra = seen.filter((id) => !listing.includes(id) && !read.onScreen.includes(id))
  expect(extra, 'an item outside the listing was loaded').toEqual([])
  expect(seen.filter((id) => listing.includes(id))).toEqual(others(listing))
}
