'use server'

import { parseCursor } from '@/platform/lib'

import { findPostsAfter } from './data/queries'

/**
 * The next published posts for the /posts listing ("Load more"): those after `cursor`, the opaque
 * string the previous page returned (#125).
 */
export async function loadMorePosts(cursor: unknown) {
  const after = parseCursor(cursor)
  if (after === null) throw new Error('Invalid request')
  return findPostsAfter(after)
}
