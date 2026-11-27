import { revalidatePath } from 'next/cache'
import type { CollectionSlug, Payload, Where } from 'payload'

/**
 * Refreshes the page at `<basePath>/<slug>` of every `collection` document matching `where`: the
 * documents on the other side of a link, which show this one (#1496). A failed lookup is logged and
 * never thrown, so a refresh can't undo the save that asked for it; the page's own 10-minute
 * refresh is the backstop (decision 0011).
 */
export async function revalidateLinkedPages({
  payload,
  collection,
  where,
  basePath,
}: {
  payload: Payload
  collection: CollectionSlug
  where: Where
  basePath: string
}): Promise<void> {
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
    for (const doc of docs) {
      const { slug } = doc as { slug?: string | null }
      if (slug) revalidatePath(`${basePath}/${slug}`)
    }
  } catch (error) {
    payload.logger.error({ err: error, msg: `Could not refresh the pages linked from ${basePath}` })
  }
}
