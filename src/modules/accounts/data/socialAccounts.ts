import 'server-only'

import { randomBytes } from 'node:crypto'

import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { ROLES } from '@/platform/lib'

import {
  SOCIAL_FLOW_COOKIE,
  SOCIAL_FLOW_TTL_MS,
  toSocialFlow,
  type SocialFlow,
} from '../domain/socialCookies'
import {
  SOCIAL_SIGN_IN_CONTEXT,
  SOCIAL_SUBJECT_FIELDS,
  toAccountName,
  type SocialAccount,
  type SocialProfile,
  type SocialProvider,
} from '../domain/socialSignIn'
import { readSignedValue, signValue } from '../domain/signedValue'
import { USERS } from '../domain/usersCollection'
import { hostCookie, signingKeyFor } from './authCookies'

// The account side of a sign-in without a password (#188, decision 0020): finding and creating
// accounts, and the signed flow cookie. Starting the session is `data/session.ts`.

/** A password nobody knows, for an account a provider creates: Payload's accounts need one. */
const unknownPassword = () => randomBytes(32).toString('base64url')

async function payloadClient(): Promise<Payload> {
  return getPayload({ config: configPromise })
}

/** What the sign-in rule needs to know about an account. */
type AccountRow = {
  id: number
  role?: string | null
  _verified?: boolean | null
  lockUntil?: string | null
  email?: string
}

const toSocialAccount = (row: AccountRow): SocialAccount => ({
  id: row.id,
  role: row.role ?? ROLES.guest,
  verified: row._verified !== false,
  lockedUntil: row.lockUntil ? new Date(row.lockUntil) : null,
})

/** The account this provider's subject is linked to, or null. */
export async function findAccountBySubject(
  provider: SocialProvider,
  subject: string,
): Promise<SocialAccount | null> {
  const payload = await payloadClient()
  // The database adapter, as Payload's own login reads accounts: it returns `lockUntil` and
  // `_verified`, which the collection's access never shows
  const row = (await payload.db.findOne({
    collection: USERS,
    where: { [SOCIAL_SUBJECT_FIELDS[provider]]: { equals: subject } },
  })) as AccountRow | null
  return row ? toSocialAccount(row) : null
}

/** The account with this id, or null: who a passkey belongs to, for the sign-in rule (#1315). */
export async function findAccountById(id: number): Promise<SocialAccount | null> {
  const payload = await payloadClient()
  const row = (await payload.db.findOne({
    collection: USERS,
    where: { id: { equals: id } },
  })) as AccountRow | null
  return row ? toSocialAccount(row) : null
}

/** The account that uses this email, or null. */
export async function findAccountByEmail(email: string): Promise<SocialAccount | null> {
  const payload = await payloadClient()
  const row = (await payload.db.findOne({
    collection: USERS,
    where: { email: { equals: email } },
  })) as AccountRow | null
  return row ? toSocialAccount(row) : null
}

/**
 * A new guest account for a sign-in, already verified, since Google verified the email:
 * Payload sends no verification email. The role is forced to guest by the collection too.
 */
export async function createVerifiedAccount(profile: SocialProfile): Promise<number> {
  if (!profile.email) throw new Error('No email to create an account with')
  const payload = await payloadClient()
  const account = await payload.create({
    collection: USERS,
    data: {
      name: toAccountName(profile.name),
      email: profile.email,
      password: unknownPassword(),
      role: ROLES.guest,
      _verified: true,
      [SOCIAL_SUBJECT_FIELDS[profile.provider]]: profile.subject,
    },
    depth: 0,
    disableVerificationEmail: true,
    // Visitors can't create accounts (`create: isAdmin`), and `_verified` and the subject are
    // server-only: the server builds all of it from the provider's checked answer
    overrideAccess: true,
    context: { [SOCIAL_SIGN_IN_CONTEXT]: true },
  })
  return account.id
}

// The signed flow cookie, with its own key derived from Payload's secret (`signingKeyFor`)

/** Keeps a new sign-in's checks in this browser for the callback. */
export async function saveSocialFlow(flow: SocialFlow, now: Date): Promise<void> {
  const value = signValue(flow, await signingKeyFor('social-flow'), now, SOCIAL_FLOW_TTL_MS)
  await (await hostCookie(SOCIAL_FLOW_COOKIE)).set(value, SOCIAL_FLOW_TTL_MS / 1000)
}

/** The sign-in this browser started, or null. Clears it, so the browser sends it no more; the server keeps no record of it. */
export async function takeSocialFlow(now: Date): Promise<SocialFlow | null> {
  const cookie = await hostCookie(SOCIAL_FLOW_COOKIE)
  const value = await cookie.read()
  await cookie.clear()
  return toSocialFlow(readSignedValue(value, await signingKeyFor('social-flow'), now))
}
