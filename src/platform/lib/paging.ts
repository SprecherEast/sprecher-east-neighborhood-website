/**
 * Paging for the listings that load more as you scroll (/posts, /events). Kept free of Payload
 * and Next imports so the proxy (`src/proxy.ts`, #119), pages and server actions share one rule.
 */

/** Highest page a client may request — a sanity bound, far above real content. */
export const MAX_PAGE = 500

/**
 * One numbered page of a listing: what a page renders first. `nextCursor` is where "Load more"
 * continues from (#125), or `null` on the last page.
 */
export type FeedPage<T> = {
  docs: T[]
  page: number
  totalPages: number
  totalDocs: number
  limit: number
  nextCursor: string | null
}

/**
 * What "Load more" fetches: the items after a cursor, the cursor after them (`null` when none
 * are left) and how many items the whole listing has now.
 */
export type FeedMore<T> = {
  docs: T[]
  nextCursor: string | null
  totalDocs: number
}

/** Validates a page number coming from a URL or a client request. */
export function parsePageNumber(value: unknown): number | null {
  // Only plain decimal digits without leading zeros, or an integer: rejects "0x10", "2e2",
  // "02" (a duplicate of page 2), true, [2], etc.
  const page =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9]\d{0,3}$/.test(value)
        ? Number(value)
        : NaN
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : null
}

/** The page numbers a listing of `totalDocs` items needs at `pageSize` per page: 1, 2, … */
export function toPageNumbers(totalDocs: number, pageSize: number): number[] {
  return Array.from({ length: Math.ceil(totalDocs / pageSize) }, (_, index) => index + 1)
}
