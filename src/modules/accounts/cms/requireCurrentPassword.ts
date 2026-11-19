import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { CONFIRM_ON_ACCOUNT_PAGE, CURRENT_PASSWORD_CONFIRMED } from '../domain/passwordConfirmation'
import { isOwnAccount } from './isOwnAccount'

/**
 * Refuses a new password on the requester's own account unless the current password was checked
 * just before (#233). Without it, an open session (an unlocked computer, a stolen cookie) could
 * still set one through `PATCH /api/users/<id>`, GraphQL or `/admin`. The account page's action
 * marks the confirmed change in the request context, which no HTTP caller can set.
 *
 * Not affected: an admin setting another account's password, new accounts, server code that runs
 * without a user (the seed), and Payload's forgot and reset password. In Payload 3.91, forgot
 * password runs `update` with only the reset token and its expiry (no password, so this hook lets
 * it through), and reset password writes to the database directly, without `beforeChange` hooks.
 * Payload reads the password before this hook runs, so the hook throws rather than strips it.
 */
export const requireCurrentPassword: CollectionBeforeChangeHook = ({
  collection,
  context,
  data,
  operation,
  originalDoc,
  req: { user },
}) => {
  if (operation !== 'update' || !data?.password) return data
  if (
    isOwnAccount(user, collection.slug, originalDoc?.id) &&
    context[CURRENT_PASSWORD_CONFIRMED] !== true
  ) {
    throw new APIError(CONFIRM_ON_ACCOUNT_PAGE, 403) // a fixed text, public like any 4xx
  }
  return data
}
