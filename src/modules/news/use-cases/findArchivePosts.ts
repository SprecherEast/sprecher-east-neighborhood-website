import 'server-only'

import type { PostSummary } from '../domain/types'
import { toCategoryIds, toPickedPosts, type StoredArchiveBlock } from '../data/mappers'
import * as queries from '../data/queries'

/** How many posts an archive block lists when the editor leaves the limit empty. */
const DEFAULT_LIMIT = 3

/**
 * The posts an archive block lists (the home page's "Recent News"): the newest published
 * posts, optionally in some categories, or the posts the editor picked.
 */
export async function findArchivePosts(block: StoredArchiveBlock): Promise<PostSummary[]> {
  if (block.populateBy !== 'collection') return toPickedPosts(block.selectedDocs)

  return queries.findLatestPosts({
    limit: block.limit || DEFAULT_LIMIT,
    categoryIds: toCategoryIds(block.categories),
  })
}
