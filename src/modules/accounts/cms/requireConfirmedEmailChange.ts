import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { EMAIL_CHANGE_NOT_ALLOWED, NEW_EMAIL_CONFIRMED } from '../domain/emailChange'
import { isOwnAccount } from './isOwnAccount'

const normalize = (email: unknown) => (typeof email === 'string' ? email.trim().toLowerCase() : '')

/**
 * Refuses a new email on the requester's own account unless the change came through the site's
 * confirm-by-link flow (#555). Payload sends a verification link only when an account is created,
 * so without this an open session (an unlocked computer, a stolen cookie) could point the account
 * at any address through `PATCH /api/users/<id>`, GraphQL or `/admin`, and it would stay marked
 * verified. The reset email and the contact form's account check both trust that mark.
 *
 * Applies to admins' own accounts too, until the change-your-email flow ships (#553). Not
 * affected: an admin changing another account's email, new accounts, server code that runs
 * without a user (the seed), and requests that send the email it already has. Payload reads the
 * email before this hook runs, so the hook throws rather than strips it.
 */
export const requireConfirmedEmailChange: CollectionBeforeChangeHook = ({
  collection,
  context,
  data,
  operation,
  originalDoc,
  req: { user },
}) => {
  if (operation !== 'update' || !data?.email) return data
  if (normalize(data.email) === normalize(originalDoc?.email)) return data
  if (
    isOwnAccount(user, collection.slug, originalDoc?.id) &&
    context[NEW_EMAIL_CONFIRMED] !== true
  ) {
    throw new APIError(EMAIL_CHANGE_NOT_ALLOWED, 403) // a fixed text, public like any 4xx
  }
  return data
}
