import 'server-only'

import { after } from 'next/server'

import { runUseCase } from '@/platform/service'

import { sendEmailToAccount } from '../data/accountEmail'
import { deleteOwnPasskey, findPasskeyById, listPasskeys } from '../data/passkeys'
import { getSignInSession } from '../data/session'
import { toPasskeyRemovedEmail } from '../domain/passkeyEmail'
import { decideRemovePasskey } from '../domain/passkeys'
import {
  toPasskeyListItem,
  type PasskeyListItem,
  type RemovePasskeyFailure,
  type RemovePasskeyInput,
} from '../domain/removePasskey'
import type { ActionResult } from '../domain/types'

// Seeing and removing your own passkeys on the account page (#1316, decision 0021). The account
// always comes from the session, never from input. Removing needs a recent sign-in, the same
// rule as adding. A passkey that is missing, or another account's, is the same one `failed`, so
// no answer says whether another account has it.

const FAILED = { ok: false, failure: 'failed' } as const

/** The account's passkeys for its page, as plain items. The account is the page's, from the session. */
export async function getOwnPasskeys(accountId: number): Promise<PasskeyListItem[]> {
  return (await listPasskeys(accountId)).map(toPasskeyListItem)
}

/**
 * Removes one of the session's account's passkeys. The session must be a recent sign-in and the
 * passkey must be the account's; then the delete carries the account in its own conditions too,
 * so a second request at the same moment finds nothing. A good removal sends the account's address
 * the label and time, with no link, after the passkey is gone. Removing the last passkey is
 * allowed: email and password, and forgot password, remain, and no account is made from a passkey.
 */
export function removePasskey({
  passkeyId,
}: RemovePasskeyInput): Promise<ActionResult<RemovePasskeyFailure>> {
  return runUseCase<ActionResult<RemovePasskeyFailure>>(
    'Passkey remove',
    () => remove(passkeyId),
    FAILED,
  )
}

async function remove(passkeyId: number): Promise<ActionResult<RemovePasskeyFailure>> {
  const session = await getSignInSession()
  if (!session) return { ok: false, failure: 'sign-in-again' }
  const now = new Date()
  const passkey = await findPasskeyById(passkeyId)
  const decision = decideRemovePasskey({
    accountId: session.accountId,
    passkeyOwnerId: passkey?.accountId ?? null,
    signedInAt: session.signedInAt,
    now,
  })
  if (!decision.ok)
    return decision.reason === 'not-yours' ? FAILED : { ok: false, failure: 'sign-in-again' }
  if (!passkey || !(await deleteOwnPasskey(session.accountId, passkey.id))) return FAILED

  after(() =>
    runUseCase(
      'Passkey removed note',
      () =>
        sendEmailToAccount(session.email, toPasskeyRemovedEmail({ label: passkey.label, at: now })),
      undefined,
    ),
  )
  return { ok: true }
}
