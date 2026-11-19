import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath } from 'next/cache'

import { documentHref } from '@/platform/payload/documentHref'
import { expireCacheTag } from '@/platform/payload/expireCacheTag'

import type { Page } from '@/payload-types'

import { PAGES_SITEMAP_CACHE_TAG } from '../domain/cacheTags'

/**
 * Refreshes the page at `slug` and the pages sitemap, then the home page and every other CMS page:
 * any of them may link to this one from a block ("top issues", a call to action, #484), and a
 * link shows the page's current slug.
 */
function revalidatePageAt(slug: string) {
  const path = documentHref('pages', slug)
  revalidatePath(path)
  revalidatePath('/')
  revalidatePath('/(frontend)/[slug]', 'page')
  expireCacheTag(PAGES_SITEMAP_CACHE_TAG)
  return path
}

export const revalidatePage: CollectionAfterChangeHook<Page> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      const path = revalidatePageAt(doc.slug ?? '')
      payload.logger.info(`Revalidated page at path: ${path}`)
    }

    // If the page was previously published, we need to revalidate the old path
    if (previousDoc?._status === 'published' && doc._status !== 'published') {
      const oldPath = revalidatePageAt(previousDoc.slug ?? '')
      payload.logger.info(`Revalidated old page at path: ${oldPath}`)
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) revalidatePageAt(doc?.slug ?? '')

  return doc
}
