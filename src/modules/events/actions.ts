'use server'

import { parseCursor } from '@/platform/lib'

import { isEventScope } from './domain/scope'
import { findEventCategoryId } from './use-cases/findEventFilterMenu'
import { findEventsAfter } from './use-cases/findEventsAfter'

/**
 * The next published upcoming or past events for the /events listing ("Load more"): those after
 * `cursor`, the opaque string the previous page returned (#125). `category` is the slug of the
 * filter on screen, or `null` for every event (#122); it must be the slug of a category, and only
 * that category's id reaches the query.
 */
export async function loadMoreEvents(scope: unknown, cursor: unknown, category: unknown = null) {
  const after = parseCursor(cursor)
  if (!isEventScope(scope) || after === null) throw new Error('Invalid request')
  if (category === null) return findEventsAfter(scope, after)

  const categoryId = await findEventCategoryId(category)
  if (categoryId === null) throw new Error('Invalid request')
  return findEventsAfter(scope, after, categoryId)
}
