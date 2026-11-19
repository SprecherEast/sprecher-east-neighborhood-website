import type { Sort, Where } from 'payload'

import type { SortCursor, SortOrder } from '@/platform/lib/cursor'

/**
 * Keyset paging (#125): a listing sorted by one date field with the id as tie-break, and the
 * filter for "everything after this item". Unlike an offset, it doesn't skip an item when one
 * the reader already has is removed between two loads.
 *
 * SQLite sorts an empty value (`NULL`) before every date, so it comes first in ascending order
 * and last in descending order; the filters below follow that.
 */

/** The total order: `field`, then `id`, both in `order`. Use it on every page of the listing. */
export function keysetSort(field: string, order: SortOrder): Sort {
  const prefix = order === 'desc' ? '-' : ''
  return [`${prefix}${field}`, `${prefix}id`]
}

/** The items that come strictly after `cursor` in `keysetSort(field, order)`. */
export function afterCursor(field: string, order: SortOrder, cursor: SortCursor): Where {
  const after = order === 'asc' ? 'greater_than' : 'less_than'
  const isEmpty: Where = { [field]: { exists: false } }
  const sameKeyLaterId = (key: Where): Where => ({ and: [key, { id: { [after]: cursor.id } }] })

  if (cursor.key === null) {
    // Ascending: the other empty ones with a later id, then every dated item.
    // Descending: the empty ones come last, so only those with a later id remain.
    return order === 'asc'
      ? { or: [sameKeyLaterId(isEmpty), { [field]: { exists: true } }] }
      : sameKeyLaterId(isEmpty)
  }

  return {
    or: [
      { [field]: { [after]: cursor.key } },
      sameKeyLaterId({ [field]: { equals: cursor.key } }),
      // Descending: the empty ones come after every dated item
      ...(order === 'desc' ? [isEmpty] : []),
    ],
  }
}
