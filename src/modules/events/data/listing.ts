import 'server-only'

import type { Where } from 'payload'

import { PUBLISHED } from '@/platform/payload/published'

import type { EventScope } from '../domain/scope'
import { inScope } from './scope'

/**
 * What every page of a listing shows: published events in the scope, and with `categoryId` only
 * those in that category (#122). The id comes from a category the server found, never from the
 * request, so no string a visitor sent reaches the query.
 */
export function inListing(scope: EventScope, today: string, categoryId?: number): Where {
  return {
    and: [
      PUBLISHED,
      inScope(scope, today),
      ...(categoryId === undefined ? [] : [{ categories: { in: [categoryId] } }]),
    ],
  }
}
