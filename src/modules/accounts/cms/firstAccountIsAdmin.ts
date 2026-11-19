import type { CollectionBeforeChangeHook } from 'payload'

import { ROLES } from '@/platform/lib'

import { USERS } from '../domain/usersCollection'
import { SIGN_UP_CONTEXT } from '../domain/signUpContext'

/**
 * Makes the first account created on an empty users collection an admin (#354). Payload's
 * first-registration screen at `/admin` has nobody signed in, so the role field's create access
 * drops whatever role was sent and the default applies; without this a fresh install (or a restore
 * onto an empty database) has no account that can use the admin. Only that registration promotes: the
 * public sign-up passes `context.signUp` and stays a guest. Every later account keeps the
 * role it was given or the default, and the role field stays admin-only to write, so no visitor
 * chooses a role. The count ignores access (`overrideAccess: true`): it must see every account.
 */
export const firstAccountIsAdmin: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  req,
}) => {
  if (operation !== 'create') return data
  // The public sign-up sets this (`SIGN_UP_CONTEXT`): it always makes a guest, even on an empty database
  if (context?.[SIGN_UP_CONTEXT]) return data
  const { totalDocs } = await req.payload.count({
    collection: USERS,
    overrideAccess: true,
    req,
  })
  return totalDocs === 0 ? { ...data, role: ROLES.admin } : data
}
