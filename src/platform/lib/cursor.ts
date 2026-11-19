/**
 * The cursor of a keyset ("load what comes after this item") listing (#125): the last loaded
 * item's sort key and its id, the tie-break that makes the order total. Clients treat it as an
 * opaque string and send it back for the next page. Kept free of Payload and Next imports, like
 * `paging.ts`: the query that uses it is `afterCursor` in `src/platform/payload/keyset.ts`.
 */

/** Which way a keyset listing runs through its sort date. */
export type SortOrder = 'asc' | 'desc'

/** Where the last item stands in its list. `key` is `null` for an item whose sort date is empty. */
export type SortCursor = {
  /** The sort date as an ISO 8601 UTC timestamp, exactly as `Date.toISOString()` writes it. */
  key: string | null
  id: number
}

/** Longest cursor accepted: a 24-character timestamp, the separator and a 16-digit id, rounded up. */
export const MAX_CURSOR_LENGTH = 64

const SEPARATOR = '|'
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ID = /^[1-9]\d{0,15}$/

/** The timestamp `value` names, as `toISOString()` writes it, or `null` when it isn't one. */
function toIsoKey(value: string): string | null {
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

/** The cursor after an item: its sort date (a date string, or empty) and its id. */
export function encodeCursor(key: string | null | undefined, id: number): string {
  const isoKey = key ? toIsoKey(key) : null
  if (key && isoKey === null) throw new Error('A cursor key must be a date')
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('A cursor id must be a positive integer')
  return `${isoKey ?? ''}${SEPARATOR}${id}`
}

/**
 * Validates a cursor coming from a client request: a string of at most `MAX_CURSOR_LENGTH`
 * characters, made of an exact UTC timestamp (or nothing) and a positive integer id, and nothing
 * else. Returns `null` for anything else, so no client value reaches a query unchecked.
 */
export function parseCursor(value: unknown): SortCursor | null {
  if (typeof value !== 'string' || value.length > MAX_CURSOR_LENGTH) return null

  const parts = value.split(SEPARATOR)
  if (parts.length !== 2) return null
  const [key, id] = parts as [string, string]

  if (!ID.test(id)) return null
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId)) return null

  if (key === '') return { key: null, id: numericId }
  // The round trip rejects dates that don't exist, like February 30
  if (!ISO_UTC.test(key) || toIsoKey(key) !== key) return null
  return { key, id: numericId }
}

/** The cursor after the last of `docs` when more items follow it, otherwise `null`. */
export function cursorAfterLast<T extends { id: number }>(
  docs: readonly T[],
  sortKey: (doc: T) => string | null | undefined,
  hasMore: boolean,
): string | null {
  const last = docs.at(-1)
  return hasMore && last ? encodeCursor(sortKey(last), last.id) : null
}
