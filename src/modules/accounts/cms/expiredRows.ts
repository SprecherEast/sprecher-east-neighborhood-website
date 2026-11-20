import type { CollectionSlug, PayloadRequest } from 'payload'

/**
 * Deletes the rows of a short-lived collection whose `expiresAt` has passed, with one conditional
 * DELETE, and says how many. Only expired rows go: one still open stays. Shared by the passkey
 * challenges (#1313) and the pending Google links (#1338), which both live minutes.
 */
export async function deleteExpiredRows(
  req: PayloadRequest,
  collection: CollectionSlug,
  now: number,
): Promise<number> {
  const where = { expiresAt: { less_than: new Date(now).toISOString() } }
  const { totalDocs } = await req.payload.db.count({ collection, where, req })
  if (totalDocs === 0) return 0
  await req.payload.db.deleteMany({ collection, where, req })
  return totalDocs
}
