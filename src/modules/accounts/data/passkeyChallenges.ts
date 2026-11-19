import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import {
  CHALLENGE_PURPOSES,
  PASSKEY_CHALLENGES,
  toChallengeExpiry,
  type ChallengePurpose,
  type TakenChallenge,
} from '../domain/passkeys'

// The one-time challenges of passkey sign-in and adding (#1313, decision 0021). Written by the
// server with access bypassed: no one may read or write the collection through an API.

/** What a stored challenge row holds, as the database adapter returns it. */
type ChallengeRow = {
  id: number
  purpose: string
  challenge: string
  account?: number | { id: number } | null
}

/**
 * Stores a challenge the library made (it is random, and the library makes it) and gives the
 * row's identifier, which is all the browser's signed cookie carries. It expires after the
 * challenge lifetime (`CHALLENGE_TTL_MS`), counted from `now`.
 */
export async function createChallenge({
  purpose,
  challenge,
  accountId,
  now,
}: {
  purpose: ChallengePurpose
  challenge: string
  accountId: number | null
  now: Date
}): Promise<number> {
  const payload = await getPayload({ config: configPromise })
  const doc = await payload.create({
    collection: PASSKEY_CHALLENGES,
    data: {
      purpose,
      challenge,
      expiresAt: toChallengeExpiry(now).toISOString(),
      account: accountId,
    },
    depth: 0,
    overrideAccess: true,
  })
  return doc.id
}

const toAccountId = (account: ChallengeRow['account']): number | null =>
  account === null || account === undefined
    ? null
    : typeof account === 'object'
      ? account.id
      : account

/**
 * Takes the challenge once: sets `usedAt` where the identifier and purpose match, nothing used it
 * and its expiry is ahead of `now`, and gives its content only when a row came back. A replay, an
 * expired one, another purpose and two takes at the same moment all get null, so at most one
 * succeeds. Take it before verifying the answer, so a failed answer still uses it up.
 *
 * This goes to the database adapter's `updateOne` with a `where`, as `markConfirmed` does
 * (`verification/cms/store.ts`): the condition sits in the UPDATE itself. Two things keep it
 * there. The identifier is inside the `where`, never the `id` argument, which would skip the
 * conditions. And the `where` names this collection's own columns only: one that needs a join is
 * answered by reading a row first and then updating it unconditionally. Neither
 * `payload.db.deleteOne` nor the Local API's `delete` qualify: both read first, then delete by id,
 * so two requests can both get the row. The adapter doesn't set `updatedAt`, so it is set here.
 */
export async function takeChallenge({
  id,
  purpose,
  now,
}: {
  id: number
  purpose: ChallengePurpose
  now: Date
}): Promise<TakenChallenge | null> {
  if (!Number.isSafeInteger(id) || id <= 0 || !CHALLENGE_PURPOSES.includes(purpose)) return null
  const payload = await getPayload({ config: configPromise })
  const at = now.toISOString()
  const row = (await payload.db.updateOne({
    collection: PASSKEY_CHALLENGES,
    where: {
      and: [
        { id: { equals: id } },
        { purpose: { equals: purpose } },
        { usedAt: { exists: false } },
        { expiresAt: { greater_than: at } },
      ],
    },
    data: { usedAt: at, updatedAt: at },
  })) as ChallengeRow | null
  if (!row) return null
  return { id: row.id, purpose, challenge: row.challenge, accountId: toAccountId(row.account) }
}
