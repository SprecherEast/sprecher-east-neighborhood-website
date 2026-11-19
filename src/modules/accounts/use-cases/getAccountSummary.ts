import 'server-only'

import { isStaffRole } from '@/platform/payload/roles'

import type { AccountSummary } from '../domain/types'
import { getCurrentUser } from '../data/session'

/** The header's view of the signed-in account (its name, and whether it's staff), or null. */
export async function getAccountSummary(): Promise<AccountSummary | null> {
  const user = await getCurrentUser()
  return user ? { name: user.name, staff: isStaffRole(user.role) } : null
}
