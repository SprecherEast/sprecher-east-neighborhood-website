import 'server-only'

import { startOfToday } from '@/platform/lib/timezone'

import type { EventSummary } from '../domain/types'
import * as queries from '../data/queries'

/** How many upcoming events a sidebar lists. */
const SIDEBAR_COUNT = 3

/** The next few upcoming events, for a sidebar; `excludeIds` leaves out the events already shown. */
export function findUpcomingEvents({
  limit = SIDEBAR_COUNT,
  excludeIds,
}: { limit?: number; excludeIds?: number[] } = {}): Promise<EventSummary[]> {
  return queries.findUpcomingEvents({ today: startOfToday(), limit, excludeIds })
}
