import 'server-only'

import { ROLES, type Role } from '@/platform/lib'

import type { CurrentUser } from '../domain/types'

/** The fields of a Payload user this module reads. `role` may be missing on old accounts. */
type UserFields = {
  id: number
  email: string
  name?: string | null
  role?: Role | null
}

/**
 * The signed-in user as pages and actions see it: no sessions, hashes or other Payload fields.
 * No role counts as a guest, as in the access checks (`platform/payload/roles.ts`).
 */
export function toCurrentUser(user: UserFields): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: user.role || ROLES.guest,
  }
}
