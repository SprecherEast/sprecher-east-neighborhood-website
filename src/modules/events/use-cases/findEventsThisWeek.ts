import 'server-only'

import { cache } from 'react'

import { startOfToday } from '@/platform/lib/timezone'

import {
  toEventsThisWeekProps,
  toWindowRowQuery,
  type StoredEventsThisWeekBlock,
} from '../data/mappers'
import { findEventsInWindow } from '../data/thisWeek'
import {
  clampWhole,
  THIS_WEEK_LIMITS,
  windowEnd,
  type EventsThisWeekProps,
} from '../domain/thisWeek'
import type { EventSummary } from '../domain/types'

/** One row's events, cached per request: two rows or blocks asking the same thing query once. */
const findRow = cache(findEventsInWindow)

/**
 * The "this week" strip of a page (#122), ready to draw: each row's published events from today
 * (site time) for the block's number of days, all rows loaded at once. A category row whose
 * category is gone lists nothing and is hidden.
 */
export async function findEventsThisWeek(
  block: StoredEventsThisWeekBlock,
  today: string = startOfToday(),
): Promise<EventsThisWeekProps> {
  const until = windowEnd(today, clampWhole(block.days, THIS_WEEK_LIMITS.days))
  const rows = (block.rows ?? []).slice(0, THIS_WEEK_LIMITS.rows.max)

  const eventsByRow = await Promise.all(
    rows.map((row): Promise<EventSummary[]> => {
      const query = toWindowRowQuery(row)
      if (!query) return Promise.resolve([])
      const categoryId = query.source === 'category' ? query.categoryId : undefined
      return findRow(today, until, query.source, query.limit, categoryId)
    }),
  )

  return toEventsThisWeekProps({ ...block, rows }, eventsByRow)
}
