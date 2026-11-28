import { ACCOUNTS_COLLECTION } from '@/platform/lib'

import { OAUTH_CLIENTS, OAUTH_TOKENS } from './constants'

/**
 * The lookups both the sign-in storage (`data/`) and the MCP credential check (`cms/`) make, each
 * written once as the arguments of a Payload query. The two layers may not import each other, and
 * both may import this, so a credential is found and judged the same way wherever it is used
 * (#1501). Plain data, no Payload import.
 */

/** The stored credential for an HMAC hash, with the client fields its rules read (#1499 adds scopes and expiry). */
export const credentialByHash = (tokenHash: string) =>
  ({
    collection: OAUTH_TOKENS,
    where: { tokenHash: { equals: tokenHash } },
    limit: 1,
    depth: 1,
    pagination: false,
    populate: {
      [OAUTH_CLIENTS]: {
        clientId: true,
        enabled: true,
        agent: true,
        scopes: true,
        expiresAt: true,
      },
    },
    overrideAccess: true,
  }) as const

/** Rows of a family that have been revoked: one is enough to end the whole family. */
export const revokedInFamily = (family: string) =>
  ({
    collection: OAUTH_TOKENS,
    where: { family: { equals: family }, revokedAt: { exists: true } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  }) as const

/** An agent account by id, in full: whether it still is an agent is `hasAgent`'s to say. */
export const accountById = (id: number) =>
  ({ collection: ACCOUNTS_COLLECTION, id, depth: 0, overrideAccess: true }) as const
