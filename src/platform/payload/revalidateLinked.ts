import { revalidatePath } from 'next/cache'
import type { CollectionSlug, Payload, Where } from 'payload'

type LinkedPages = {
  payload: Payload
  collection: CollectionSlug
  where: Where
  basePath: string
}

/**
 * The slugs of the `collection` documents matching `where`: the documents on the other side of a
 * link, which show this one (#1496). A delete reads them first, since the rows that link them are
 * gone afterward. A failed lookup is logged and gives none, so it can't undo the save or delete
 * that asked for it; the page's own 10-minute refresh is the backstop (decision 0011).
 */
export async function findLinkedSlugs({
  payload,
  collection,
  where,
  basePath,
}: LinkedPages): Promise<string[]> {
  try {
    // Only slugs are read, to name pages to refresh; nothing is returned to a visitor
    const { docs } = await payload.find({
      collection,
      where,
      select: { slug: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    return docs.flatMap((doc) => {
      const { slug } = doc as { slug?: string | null }
      return slug ? [slug] : []
    })
  } catch (error) {
    payload.logger.error({ err: error, msg: `Could not refresh the pages linked from ${basePath}` })
    return []
  }
}

/** Refreshes the page at `<basePath>/<slug>` for each slug. */
export function revalidateSlugs(basePath: string, slugs: readonly string[]): void {
  for (const slug of slugs) revalidatePath(`${basePath}/${slug}`)
}

/** Refreshes the page of every `collection` document matching `where`. */
export async function revalidateLinkedPages(args: LinkedPages): Promise<void> {
  revalidateSlugs(args.basePath, await findLinkedSlugs(args))
}
