import 'server-only'

import { randomBytes } from 'node:crypto'

import configPromise from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'

import {
  PASSKEYS,
  type NewPasskey,
  type PasskeyDeviceType,
  type StoredPasskey,
} from '../domain/passkeys'
import { USERS } from '../domain/usersCollection'

// The saved passkeys and the per-account user handle (#1313, decision 0021). Written by the
// server with access bypassed: create and update are refused to everyone through the API, and no
// resident reads the collection. Reads use the database adapter, as the accounts code does, which
// returns the hidden fields too.

async function payloadClient(): Promise<Payload> {
  return getPayload({ config: configPromise })
}

/** What a stored passkey row holds, as the database adapter returns it. */
type PasskeyRow = {
  id: number
  account: number | { id: number }
  credentialId: string
  publicKey: string
  counter?: number | null
  transports?: unknown
  deviceType: string
  backedUp?: boolean | null
  label: string
  createdAt: string
  lastUsedAt?: string | null
}

const toDeviceType = (value: string): PasskeyDeviceType =>
  value === 'singleDevice' ? 'singleDevice' : 'multiDevice'

const toStoredPasskey = (row: PasskeyRow): StoredPasskey => ({
  id: row.id,
  accountId: typeof row.account === 'object' ? row.account.id : row.account,
  credentialId: row.credentialId,
  publicKey: row.publicKey,
  counter: row.counter ?? 0,
  transports: Array.isArray(row.transports)
    ? row.transports.filter((t): t is string => typeof t === 'string')
    : [],
  deviceType: toDeviceType(row.deviceType),
  backedUp: row.backedUp === true,
  label: row.label,
  addedAt: new Date(row.createdAt),
  lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
})

/**
 * Saves a passkey, and only ever inserts: a credential ID already stored on any account refuses
 * the save and leaves the stored key as it was, so no one can replace another's key. The unique
 * credential ID decides, also for two saves at once. Anything else that fails is thrown.
 */
export async function savePasskey(
  passkey: NewPasskey,
): Promise<{ saved: true; id: number } | { saved: false }> {
  const payload = await payloadClient()
  try {
    const doc = await payload.create({
      collection: PASSKEYS,
      data: {
        account: passkey.accountId,
        credentialId: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        label: passkey.label,
      },
      depth: 0,
      overrideAccess: true,
    })
    return { saved: true, id: doc.id }
  } catch (error) {
    const { totalDocs } = await payload.count({
      collection: PASSKEYS,
      where: { credentialId: { equals: passkey.credentialId } },
      overrideAccess: true,
    })
    if (totalDocs > 0) return { saved: false }
    throw error
  }
}

/** The passkey with this credential ID, on whichever account, or null. */
export async function findPasskeyByCredentialId(
  credentialId: string,
): Promise<StoredPasskey | null> {
  const payload = await payloadClient()
  const row = (await payload.db.findOne({
    collection: PASSKEYS,
    where: { credentialId: { equals: credentialId } },
  })) as PasskeyRow | null
  return row ? toStoredPasskey(row) : null
}

/** An account's passkeys, oldest first. */
export async function listPasskeys(accountId: number): Promise<StoredPasskey[]> {
  const payload = await payloadClient()
  const { docs } = await payload.db.find({
    collection: PASSKEYS,
    where: { account: { equals: accountId } },
    sort: 'createdAt',
    pagination: false,
  })
  return (docs as PasskeyRow[]).map(toStoredPasskey)
}

/** How many passkeys an account has, for the cap. */
export async function countPasskeys(accountId: number): Promise<number> {
  const payload = await payloadClient()
  const { totalDocs } = await payload.db.count({
    collection: PASSKEYS,
    where: { account: { equals: accountId } },
  })
  return totalDocs
}

/**
 * Records a use: the time always, and the signature counter only when `counter` is higher than
 * the stored one, in one conditional UPDATE. So two sign-ins finishing at once can't lower it,
 * and a synced passkey that always reports zero keeps zero. Says whether the counter went up.
 */
export async function recordPasskeyUse(
  id: number,
  counter: number,
  at: Date,
): Promise<{ counterRaised: boolean }> {
  const payload = await payloadClient()
  const time = at.toISOString()
  const raised = await payload.db.updateOne({
    collection: PASSKEYS,
    where: { and: [{ id: { equals: id } }, { counter: { less_than: counter } }] },
    data: { counter, lastUsedAt: time, updatedAt: time },
  })
  if (raised) return { counterRaised: true }
  await payload.db.updateOne({
    collection: PASSKEYS,
    where: { id: { equals: id } },
    data: { lastUsedAt: time, updatedAt: time },
    returning: false,
  })
  return { counterRaised: false }
}

/**
 * Removes the passkey, only when it belongs to this account, with one conditional DELETE, and
 * says whether one went. The caller decides who may (`decideRemovePasskey`); this keeps another
 * account's passkey in place even if it is asked to remove it.
 */
export async function deleteOwnPasskey(accountId: number, passkeyId: number): Promise<boolean> {
  const payload = await payloadClient()
  const where: Where = {
    and: [{ id: { equals: passkeyId } }, { account: { equals: accountId } }],
  }
  const { totalDocs } = await payload.db.count({ collection: PASSKEYS, where })
  if (totalDocs === 0) return false
  await payload.db.deleteMany({ collection: PASSKEYS, where })
  return true
}

type HandleRow = { id: number; passkeyUserHandle?: string | null }

/** The account's stored user handle, or null when none was made yet. */
export async function findUserHandle(accountId: number): Promise<string | null> {
  const payload = await payloadClient()
  const row = (await payload.db.findOne({
    collection: USERS,
    where: { id: { equals: accountId } },
  })) as HandleRow | null
  return row?.passkeyUserHandle || null
}

/**
 * The account's user handle: one random, opaque value per account, reused for every passkey it
 * adds, never the email or the database id. Written only while empty, in one conditional
 * UPDATE, so two adds at once keep one value and the loser reads the winner's. Throws for an
 * account that doesn't exist.
 */
export async function getOrCreateUserHandle(accountId: number): Promise<string> {
  const existing = await findUserHandle(accountId)
  if (existing) return existing
  const payload = await payloadClient()
  const handle = randomBytes(32).toString('base64url')
  const written = (await payload.db.updateOne({
    collection: USERS,
    where: { and: [{ id: { equals: accountId } }, { passkeyUserHandle: { exists: false } }] },
    data: { passkeyUserHandle: handle, updatedAt: new Date().toISOString() },
  })) as HandleRow | null
  if (written) return handle
  const winner = await findUserHandle(accountId)
  if (!winner) throw new Error('No account to hold a passkey user handle')
  return winner
}
