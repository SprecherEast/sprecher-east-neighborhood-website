import type { PayloadRequest } from 'payload'

/** Whether the signed-in requester is the account being changed (a user of this collection). */
export const isOwnAccount = (
  requester: PayloadRequest['user'],
  collectionSlug: string,
  originalId: unknown,
): boolean =>
  requester?.collection === collectionSlug && String(requester.id) === String(originalId)
