// What removing a passkey asks and answers (#1316, decision 0021): the input, the fixed failure
// codes and the plain shape the account page's list gets. Who may remove one is
// `decideRemovePasskey` in `passkeys.ts`. Pure: no Payload or Next.js.

import { z } from 'zod'

import type { StoredPasskey } from './passkeys'

/**
 * The input to remove a passkey: its id and nothing else. Parsed again on the server because
 * anyone can call an action directly; a field the caller adds, such as an account, is dropped,
 * since the account always comes from the session.
 */
export const removePasskeySchema = z.object({ passkeyId: z.number().int().positive().safe() })

export type RemovePasskeyInput = z.infer<typeof removePasskeySchema>

/**
 * Why removing a passkey didn't go ahead, as fixed codes the screen turns into fixed messages:
 * the sign-in is too old (or gone), or anything else. One `failed` for every other reason (no
 * such passkey, someone else's passkey, a failed delete), so no answer says which check refused
 * or whether another account has that passkey.
 */
export type RemovePasskeyFailure = 'sign-in-again' | 'failed'

/** One passkey in the account page's list: the times are ISO text, safe to pass to the browser. */
export type PasskeyListItem = {
  id: number
  label: string
  addedAt: string
  lastUsedAt: string | null
}

/** A stored passkey as the list shows it: never the credential ID, key or counter. */
export const toPasskeyListItem = ({
  id,
  label,
  addedAt,
  lastUsedAt,
}: StoredPasskey): PasskeyListItem => ({
  id,
  label,
  addedAt: addedAt.toISOString(),
  lastUsedAt: lastUsedAt ? lastUsedAt.toISOString() : null,
})
