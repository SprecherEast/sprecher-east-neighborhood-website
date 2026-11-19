import type { SanitizedConfig } from 'payload'

/**
 * Runs the real config's access functions as Payload does, for the policy tests (#140): no
 * database, only the functions.
 */

export type Audience = 'visitor' | 'guest' | 'resident' | 'agent'

export const AUDIENCES: Record<Audience, unknown> = {
  visitor: null,
  guest: { id: 6, role: 'guest', collection: 'users' },
  resident: { id: 7, role: 'resident', collection: 'users' },
  // An agent account, as its MCP API key acts (#336)
  agent: { id: 8, role: 'agent', collection: 'users' },
}

export type AccessFn = (args: unknown) => unknown

/** Runs an access function the way Payload does for this audience and returns its result. */
export async function accessResult(
  access: unknown,
  audience: Audience,
  id?: number,
): Promise<unknown> {
  const user = AUDIENCES[audience]
  // With no access function, Payload lets any signed-in user through (`executeAccess`)
  if (access === undefined) return user !== null
  if (typeof access !== 'function') throw new Error('access is not a function')
  return (access as AccessFn)({
    req: { user, headers: new Headers(), payload: { config: { admin: { user: 'users' } } } },
    id,
  })
}

/** True when the access function lets the audience through (a query filter counts as yes). */
export async function allows(access: unknown, audience: Audience, id?: number): Promise<boolean> {
  return (await accessResult(access, audience, id)) !== false
}

/** The real, sanitized config. */
export const loadConfig = async (): Promise<SanitizedConfig> =>
  (await import('@payload-config')).default
