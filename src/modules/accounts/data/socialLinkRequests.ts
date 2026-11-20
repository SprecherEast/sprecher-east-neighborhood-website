import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { PENDING_LINK_TTL_MS, SOCIAL_LINK_REQUESTS } from '../domain/googleLink'
import { readSignedValue, signValue } from '../domain/signedValue'
import {
  SOCIAL_FLOW_COOKIE,
  SOCIAL_LINK_KEY_PURPOSE,
  toPendingLinkId,
} from '../domain/socialCookies'
import { SOCIAL_PROVIDERS, type SocialProfile, type SocialProvider } from '../domain/socialSignIn'
import { hostCookie, signingKeyFor } from './authCookies'

// What Google said while a neighbor enters their password to connect it (#1338, decision 0020):
// the Google id and the verified email, kept on the server and tied to the browser by the flow's
// own cookie, set again with only the record's row. Written with access bypassed: no one reads or
// writes the collection through an API.

/** What a pending record holds, as the database adapter returns it. */
type LinkRow = { id: number; provider: string; subject: string; email: string }

/** What Google said, once the password step takes the record. */
export type PendingLink = { provider: SocialProvider; subject: string; email: string }

const isProvider = (value: string): value is SocialProvider =>
  (SOCIAL_PROVIDERS as readonly string[]).includes(value)

/** Stores Google's checked answer (it needs a verified email) and gives the row's identifier. */
export async function createPendingLink(
  { provider, subject, email }: SocialProfile & { email: string },
  now: Date,
): Promise<number> {
  const payload = await getPayload({ config: configPromise })
  const doc = await payload.create({
    collection: SOCIAL_LINK_REQUESTS,
    data: {
      provider,
      subject,
      email,
      expiresAt: new Date(now.getTime() + PENDING_LINK_TTL_MS).toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  })
  return doc.id
}

/**
 * Whether a record is still waiting: stored, unused and not expired. Reads only, so the password
 * page can say a link has run out before the person types; the password step still takes the
 * record once (`takePendingLink`).
 */
export async function isPendingLinkOpen(id: number, now: Date): Promise<boolean> {
  const payload = await getPayload({ config: configPromise })
  const { totalDocs } = await payload.db.count({
    collection: SOCIAL_LINK_REQUESTS,
    where: {
      and: [
        { id: { equals: id } },
        { usedAt: { exists: false } },
        { expiresAt: { greater_than: now.toISOString() } },
      ],
    },
  })
  return totalDocs > 0
}

/**
 * Takes the record once: sets `usedAt` where the identifier matches, nothing used it and its
 * expiry is ahead of `now`, and gives its content only when a row came back. A replay, an expired
 * record and two takes at the same moment all get null, so at most one succeeds. The condition
 * sits in the UPDATE itself, as `takeChallenge` does (`data/passkeyChallenges.ts`): the
 * identifier is inside the `where`, never the `id` argument, which would skip the conditions.
 */
export async function takePendingLink(id: number, now: Date): Promise<PendingLink | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const payload = await getPayload({ config: configPromise })
  const at = now.toISOString()
  const row = (await payload.db.updateOne({
    collection: SOCIAL_LINK_REQUESTS,
    where: {
      and: [
        { id: { equals: id } },
        { usedAt: { exists: false } },
        { expiresAt: { greater_than: at } },
      ],
    },
    data: { usedAt: at, updatedAt: at },
  })) as LinkRow | null
  if (!row || !isProvider(row.provider)) return null
  return { provider: row.provider, subject: row.subject, email: row.email }
}

// The pending-link cookie: the flow's own cookie, set again with the record's row, signed under
// its own key so it never reads as a flow, and `__Host-` prefixed where cookies are Secure.

/** Keeps the record's row in this browser for the record's lifetime. */
export async function savePendingLinkCookie(id: number, now: Date): Promise<void> {
  const value = signValue(
    { pid: id },
    await signingKeyFor(SOCIAL_LINK_KEY_PURPOSE),
    now,
    PENDING_LINK_TTL_MS,
  )
  await (await hostCookie(SOCIAL_FLOW_COOKIE)).set(value, PENDING_LINK_TTL_MS / 1000)
}

/** The record this browser was given, or null: reads the cookie and leaves it. */
export async function readPendingLinkCookie(now: Date): Promise<number | null> {
  const value = await (await hostCookie(SOCIAL_FLOW_COOKIE)).read()
  return toPendingLinkId(readSignedValue(value, await signingKeyFor(SOCIAL_LINK_KEY_PURPOSE), now))
}

/** The record this browser was given, or null. Clears the cookie either way, so it serves one try. */
export async function takePendingLinkCookie(now: Date): Promise<number | null> {
  const cookie = await hostCookie(SOCIAL_FLOW_COOKIE)
  const value = await cookie.read()
  await cookie.clear()
  return toPendingLinkId(readSignedValue(value, await signingKeyFor(SOCIAL_LINK_KEY_PURPOSE), now))
}
