import type { CollectionBeforeDeleteHook } from 'payload'

import { PASSKEY_CHALLENGES, PASSKEYS } from '../domain/passkeys'

/**
 * Deleting an account deletes its passkeys and any open challenge of its own (#1313, decision
 * 0021), so a resident's own delete (#310) and an admin's both leave nothing behind. It runs
 * before the delete, while the rows can still be found by the account. Each is one DELETE on the
 * database adapter, which runs no hooks: that skips the note an admin's delete of one passkey
 * sends (`passkeyRemovedNote`), right, since the account is going. Neither collection has versions,
 * and no one may delete them through the API. A failure stops the account's delete with it.
 */
export const deletePasskeysWithAccount: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of [PASSKEYS, PASSKEY_CHALLENGES] as const) {
    await req.payload.db.deleteMany({ collection, where: { account: { equals: id } }, req })
  }
}
