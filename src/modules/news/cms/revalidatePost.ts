import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath } from 'next/cache'

import type { Post } from '@/payload-types'
import { expireCacheTag } from '@/platform/payload/expireCacheTag'

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

export const revalidatePost: CollectionAfterChangeHook<Post> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      payload.logger.info(`Revalidating post at /posts/${doc.slug}`)
      revalidatePostPages(doc.slug)
    }

    if (previousDoc?._status === 'published' && doc._status !== 'published') {
      payload.logger.info(`Revalidating old post at /posts/${previousDoc.slug}`)
      revalidatePostPages(previousDoc.slug)
    }
  }

  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) revalidatePostPages(doc.slug)

  return doc
}
