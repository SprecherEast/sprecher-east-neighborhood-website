import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { sha256Hex } from '@/platform/lib/sha256'

import { EMAIL_CONFIRMATIONS } from '../domain/paths'
import type { ConfirmationRecord } from '../domain/types'

/**
 * The state of the confirmation whose latest link has this token, or `null` (#391). Reads only
 * whether and until when the link works: the page shows a message, never the address.
 */
export async function findLinkState(
  token: string,
): Promise<Pick<ConfirmationRecord, 'confirmedAt' | 'tokenExpiresAt'> | null> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: EMAIL_CONFIRMATIONS,
    where: { tokenHash: { equals: sha256Hex(token) } },
    select: { confirmedAt: true, tokenExpiresAt: true },
    limit: 1,
    depth: 0,
    pagination: false,
    // The collection is admin-only; the link's token is the proof, and only its state comes back
    overrideAccess: true,
  })
  const doc = docs[0]
  return doc ? { confirmedAt: doc.confirmedAt || null, tokenExpiresAt: doc.tokenExpiresAt || null } : null
}
