import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
} from 'payload'
import { revalidatePath } from 'next/cache'

import { expireCacheTag } from '@/platform/payload/expireCacheTag'
import { PUBLISHED } from '@/platform/payload/published'
import {
  findLinkedSlugs,
  revalidateLinkedPages,
  revalidateSlugs,
} from '@/platform/payload/revalidateLinked'

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

export const revalidateEvent: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  const unpublished = previousDoc?._status === 'published' && doc._status !== 'published'
  if (doc._status === 'published') {
    payload.logger.info(`Revalidating event at /events/${doc.slug}`)
    revalidateEventPages(doc.slug)
  }
  if (unpublished) {
    payload.logger.info(`Revalidating old event at /events/${previousDoc.slug}`)
    revalidateEventPages(previousDoc.slug)
  }

  // The posts that pick this event show it in their related events (#1496)
  if (doc._status === 'published' || unpublished) {
    await revalidateLinkedPages({ payload, ...postsPicking(doc.id) })
  }

  return doc
}

/** The published posts that pick an event, as a query, for a save or for the read before a delete. */
const postsPicking = (id: number | string) => ({
  collection: 'posts' as const,
  where: { and: [PUBLISHED, { relatedEvents: { equals: id } }] },
  basePath: '/posts',
})

/** Where `readPostsBeforeDelete` keeps the posts' slugs until the event is gone. */
const POSTS_OF_DELETED_EVENT = 'postSlugsOfDeletedEvent'

/** Read the posts that pick the event now: once it is deleted, nothing links to them (#1496). */
export const readPostsBeforeDelete: CollectionBeforeDeleteHook = async ({
  id,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return
  context[POSTS_OF_DELETED_EVENT] = await findLinkedSlugs({ payload, ...postsPicking(id) })
}

export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
  if (context.disableRevalidate) return doc
  revalidateEventPages(doc.slug)
  revalidateSlugs('/posts', (context[POSTS_OF_DELETED_EVENT] as string[] | undefined) ?? [])

  return doc
}
