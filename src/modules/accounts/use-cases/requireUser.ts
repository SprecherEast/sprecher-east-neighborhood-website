import 'server-only'

import { notFound, redirect } from 'next/navigation'

import type { Role } from '@/platform/lib'

import { SIGN_IN_PATH } from '../domain/paths'
import type { CurrentUser } from '../domain/types'
import { getCurrentUser } from '../data/session'

/** The signed-in user. A visitor is sent to the sign-in page instead. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(SIGN_IN_PATH)
  return user
}

/**
 * The signed-in user, if their role is one of `roles`. A visitor is sent to the sign-in page;
 * anyone signed in with another role gets the 404 page, so a page they may not use stays hidden.
 */
export async function requireRole(...roles: [Role, ...Role[]]): Promise<CurrentUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) notFound()
  return user
}
