import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath } from 'next/cache'

import { expireCacheTag } from '@/platform/payload/expireCacheTag'

import { EVENTS_SITEMAP_CACHE_TAG } from '../domain/cacheTags'

/**
 * Refreshes every cached page that shows the event at `slug`: its own page, /events, each
 * category's page (/events/category/<slug>, #122), and the no-JavaScript list pages
 * (/events/list/<scope>/<n> and a category's), which are cached per URL and refreshed all together
 * so page 2+ never disagrees with page 1 after an edit. Every category's page is refreshed, not
 * just the event's: the filter row on each lists every category and its count. A route pattern
 * must name the route groups: Next tags cached pages with their app path, (frontend) included.
 * The home page and every CMS page are refreshed too, since any of them may hold the "this week"
 * strip (#122): its rows are Local API reads inside the page's render, cached with the page.
 */
function revalidateEventPages(slug: string) {
  revalidatePath(`/events/${slug}`)
  revalidatePath('/events')
  revalidatePath('/(frontend)/events/(index)/category/[category]', 'page')
  revalidatePath('/(frontend)/events/list/[scope]/[page]', 'page')
  revalidatePath('/(frontend)/events/category/[category]/list/[scope]/[page]', 'page')
  revalidatePath('/')
  revalidatePath('/(frontend)/[slug]', 'page')
  expireCacheTag('events')
  expireCacheTag(EVENTS_SITEMAP_CACHE_TAG)
}

export const revalidateEvent: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      payload.logger.info(`Revalidating event at /events/${doc.slug}`)
      revalidateEventPages(doc.slug)
    }

    if (previousDoc?._status === 'published' && doc._status !== 'published') {
      payload.logger.info(`Revalidating old event at /events/${previousDoc.slug}`)
      revalidateEventPages(previousDoc.slug)
    }
  }

  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) revalidateEventPages(doc.slug)

  return doc
}
