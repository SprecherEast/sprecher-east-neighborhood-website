import 'server-only'

import { randomBytes } from 'node:crypto'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ROLES } from '@/platform/lib'
import { getServerSideURL } from '@/platform/lib/getURL'
import { sha256Hex } from '@/platform/lib/sha256'

import type { SignUpValues, VerifyAccountValues } from '../domain/credentials'
import { SIGN_UP_CONTEXT } from '../domain/signUpContext'
import { USERS } from '../domain/usersCollection'
import { takeResend } from '../domain/verificationResends'
import { toVerifyAccountEmail, toVerifyAccountLink } from '../domain/verifyAccountEmail'

/**
 * Creates a guest account with Payload's `create` operation (#187). With `auth.verify` on the
 * users collection, Payload stores it unverified, with a one-time token, and emails the link
 * (`auth.verify` in `cms/users.ts`); it can't sign in until that link is opened. Throws Payload's
 * error when it refuses (400: an account already uses the email) or fails.
 */
export async function createResidentAccount({
  name,
  email,
  newPassword,
}: Pick<SignUpValues, 'name' | 'email' | 'newPassword'>): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.create({
    collection: USERS,
    // Built here from the parsed form only: the role is always guest, and nothing else a
    // visitor sends (such as `_verified`) can reach the account
    data: { name, email, password: newPassword, role: ROLES.guest },
    depth: 0,
    // The collection lets only admins create accounts (`create: isAdmin`), so `POST /api/users`
    // stays closed to visitors. This is the one way a visitor gets an account, and the server
    // decides everything about it but the name, email and password.
    overrideAccess: true,
    // Always a guest, even on an empty database: only Payload's first registration makes an admin
    context: { [SIGN_UP_CONTEXT]: true },
  })
}

/**
 * Deletes the unverified account `createResidentAccount` stored for `email` at or after `since`,
 * when its verification email then failed (#187). Without it the address would be stuck: SQLite
 * runs Payload's `create` without a transaction, so the account stays, a second sign-up is refused
 * as a duplicate, and an unverified account gets no reset email. Verified accounts, and accounts
 * older than this request, are never touched.
 */
export async function deleteFailedSignUp(email: string, since: Date): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.delete({
    collection: USERS,
    where: {
      and: [
        { email: { equals: email } },
        { _verified: { not_equals: true } },
        { createdAt: { greater_than_equal: since.toISOString() } },
      ],
    },
    depth: 0,
    // Visitors can't delete accounts (`delete: isAdmin`); this undoes the server's own create
    overrideAccess: true,
  })
}

/** What a resend did: sent a new link, or nothing (no unverified account, or the cap is reached). */
export type ResendOutcome = 'sent' | 'none' | 'capped'

/**
 * Sends a new verification link to the account that uses `email`, if it isn't verified yet and
 * its resend count allows it (#289). Payload 3.91 has no resend: its `sendVerificationEmail`
 * isn't exported. So this does what Payload's `create` does: a new token, the same way Payload
 * makes it, then the same branded email, now with Payload's `sendEmail`. The old link stops
 * working, and the new one asks for a password before it opens the account. Writes with `db.updateOne`, as Payload's own `verifyEmail` does: the token and the
 * count are server-only fields, and no hook applies to them.
 */
export async function resendVerification(email: string, now: Date): Promise<ResendOutcome> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: USERS,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    pagination: false,
    // A visitor signing up may read no account: the server reads its verification state and
    // resend count, and nothing about it reaches the visitor
    overrideAccess: true,
    showHiddenFields: true,
  })
  const account = docs[0]
  if (!account || account._verified !== false) return 'none'

  const since = account.verificationResendsSince ? new Date(account.verificationResendsSince) : null
  const take = takeResend({ resends: account.verificationResends ?? 0, since }, now)
  if (!take.allowed) return 'capped'

  const token = randomBytes(20).toString('hex')
  await payload.db.updateOne({
    collection: USERS,
    id: account.id,
    data: {
      _verificationToken: token,
      verificationResends: take.next.resends,
      verificationResendsSince: take.next.since?.toISOString() ?? null,
      // Whoever opens this link chooses the password: the first sign-up's may not be theirs
      verificationSetsPassword: true,
    },
    returning: false,
  })
  const message = toVerifyAccountEmail(toVerifyAccountLink(getServerSideURL(), token))
  await payload.sendEmail({
    to: account.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
  return 'sent'
}

/**
 * Whether the account a verification link belongs to was resent its link, so that whoever opens
 * it must choose the password (#289). `null` when no account holds the token.
 */
export async function findPendingVerification(
  token: string,
): Promise<{ id: number; setsPassword: boolean } | null> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: USERS,
    where: { _verificationToken: { equals: token } },
    limit: 1,
    depth: 0,
    pagination: false,
    // The link's token is the proof, as for Payload's own verify; the server reads one flag
    overrideAccess: true,
    showHiddenFields: true,
  })
  const account = docs[0]
  return account
    ? { id: account.id, setsPassword: account.verificationSetsPassword === true }
    : null
}

/**
 * Sets the password the person chose on the verify page and clears the flag (#289), with
 * Payload's `update`, which hashes it. No user runs this, so `requireCurrentPassword` lets it
 * through, as it does for the seed.
 */
export async function setPasswordFromVerification(id: number, password: string): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.update({
    collection: USERS,
    id,
    data: { password, verificationSetsPassword: false },
    depth: 0,
    // Visitors can't update accounts; holding this account's link is the proof
    overrideAccess: true,
  })
}

/**
 * Opens a verification link with Payload's `verifyEmail` operation, which marks the account
 * verified and clears the token, so the link works once. Throws Payload's error when it refuses
 * (403: unknown or used token). Payload's operation takes no `overrideAccess`: the token is the
 * proof, as on `POST /api/users/verify/<token>`.
 */
export async function verifyAccountToken({
  token,
}: Pick<VerifyAccountValues, 'token'>): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.verifyEmail({ collection: USERS, token })
}

/**
 * Remembers which link verified the account (#391), as a hash, once Payload has cleared its
 * token, so the same link opened again can say "already confirmed". Written with `db.updateOne`,
 * like the resend: a server-only field, and no hook needs to run.
 */
export async function recordVerifiedToken(id: number, token: string): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.db.updateOne({
    collection: USERS,
    id,
    data: { verifiedTokenHash: sha256Hex(token) },
    returning: false,
  })
}

/**
 * Whether this link already verified its account (#391): the hash `recordVerifiedToken` kept.
 * Only a yes or no comes back, never the account.
 */
export async function wasVerifiedWithToken(token: string): Promise<boolean> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: USERS,
    where: { verifiedTokenHash: { equals: sha256Hex(token) } },
    select: { verifiedTokenHash: true },
    limit: 1,
    depth: 0,
    pagination: false,
    // The link's token is the proof, as for Payload's own verify; only a yes or no comes back
    overrideAccess: true,
  })
  return docs.length > 0
}
