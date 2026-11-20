import type { CollectionAfterDeleteHook } from 'payload'

import { toPasskeyRemovedEmail } from '../domain/passkeyEmail'
import { USERS } from '../domain/usersCollection'

/**
 * An admin deleting a passkey in `/admin` sends its account's address the same short note a
 * resident's own removal does (#1316, decision 0021): the label, the time, no link. It runs after
 * the delete, so a failed note is logged and never brings the passkey back. A resident's own
 * removal and the delete of a whole account go through the database adapter, which runs no hooks:
 * the first sends the note from its use case, the second sends none, since the account is going.
 */
export const passkeyRemovedNote: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    const account = typeof doc.account === 'object' ? doc.account?.id : doc.account
    if (account === null || account === undefined) return
    const owner = (await req.payload.db.findOne({
      collection: USERS,
      where: { id: { equals: account } },
    })) as { email?: string | null } | null
    if (!owner?.email) return
    const { subject, text, html } = toPasskeyRemovedEmail({
      label: String(doc.label),
      at: new Date(),
    })
    await req.payload.sendEmail({ to: owner.email, subject, text, html })
  } catch (error) {
    // Only the error's class name: a database error carries the query's values, such as an email
    req.payload.logger.error(
      `Passkey removed note failed (${error instanceof Error ? error.name : typeof error})`,
    )
  }
}
