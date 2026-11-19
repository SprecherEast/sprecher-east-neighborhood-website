import 'server-only'

import type { FeedMore, SortCursor } from '@/platform/lib'
import { startOfToday } from '@/platform/lib/timezone'

import type { EventScope } from '../domain/scope'
import type { EventSummary } from '../domain/types'
import * as queries from '../data/queries'

/**
 * The upcoming or past events after `cursor` ("Load more"), as of today in the site timezone, in
 * the category with id `categoryId` when one is given (#122).
 */
export function findEventsAfter(
  scope: EventScope,
  cursor: SortCursor,
  categoryId?: number,
): Promise<FeedMore<EventSummary>> {
  return queries.findEventsAfter(scope, cursor, startOfToday(), categoryId)
}
