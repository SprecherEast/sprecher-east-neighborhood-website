import type { CollectionBeforeChangeHook } from 'payload'

import { ROLES } from '@/platform/lib'

import { SOCIAL_SIGN_IN_CONTEXT } from '../domain/socialSignIn'

/**
 * An account a provider sign-in creates is always a guest (decision 0020), never a
 * resident, since signing in with a provider doesn't verify where someone lives (#314): whatever the
 * create's data says, the role is forced here, so a mistake in that code can't grant more. It
 * keys on the context flag, not on `req.user`, because the seed and Payload's first-user screen
 * create admins with no user either. The flag can only lower a role, and runs after `firstAccountIsAdmin`.
 */
export const guestOnlyFromProviders: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
}) => {
  if (operation !== 'create' || context[SOCIAL_SIGN_IN_CONTEXT] !== true) return data
  return { ...data, role: ROLES.guest }
}
