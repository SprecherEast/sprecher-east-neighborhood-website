import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath } from 'next/cache'

import type { Post } from '@/payload-types'
import { expireCacheTag } from '@/platform/payload/expireCacheTag'
import { idsOf } from '@/platform/payload/idsOf'
import { revalidateLinkedPages } from '@/platform/payload/revalidateLinked'

import { POSTS_SITEMAP_CACHE_TAG } from '../domain/cacheTags'

/**
 * Refreshes every cached page that shows the post at `slug`, instead of waiting for the 10-minute
 * ISR window: its own page, /posts, its numbered no-JavaScript pages, the home page and every
 * CMS page (their archive and "top issues" blocks show its title and link to its slug, #484), and
 * the posts sitemap. A route pattern must name the route group: Next tags cached pages with their
 * app path, (frontend) included.
 */
function revalidatePostPages(slug: string) {
  revalidatePath(`/posts/${slug}`)
  revalidatePath('/posts')
  revalidatePath('/(frontend)/posts/page/[pageNumber]', 'page')
  revalidatePath('/')
  revalidatePath('/(frontend)/[slug]', 'page')
  expireCacheTag(POSTS_SITEMAP_CACHE_TAG)
}

export const revalidatePost: CollectionAfterChangeHook<Post> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc

  const unpublished = previousDoc?._status === 'published' && doc._status !== 'published'
  if (doc._status === 'published') {
    payload.logger.info(`Revalidating post at /posts/${doc.slug}`)
    revalidatePostPages(doc.slug)
  }
  if (unpublished) {
    payload.logger.info(`Revalidating old post at /posts/${previousDoc.slug}`)
    revalidatePostPages(previousDoc.slug)
  }

  // The events it links show it, and the ones it no longer links stop showing it (#1496)
  if (doc._status === 'published' || unpublished) {
    const events = [...new Set([...idsOf(doc.relatedEvents), ...idsOf(previousDoc?.relatedEvents)])]
    if (events.length > 0) {
      await revalidateLinkedPages({
        payload,
        collection: 'events',
        where: { id: { in: events } },
        basePath: '/events',
      })
    }
  }

  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) revalidatePostPages(doc.slug)

  return doc
}
