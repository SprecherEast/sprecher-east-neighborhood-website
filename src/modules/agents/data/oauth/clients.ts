import 'server-only'

import type { Payload } from 'payload'

import { ROLES } from '@/platform/lib'

import { OAUTH_CLIENTS } from '../../domain/oauth/constants'
import type { OAuthClient } from '../../domain/oauth/types'

/** The client an admin registered under this ID, or null. Reads past access: only the server asks. */
export async function findOAuthClient(
  payload: Payload,
  clientId: string,
): Promise<OAuthClient | null> {
  const { docs } = await payload.find({
    collection: OAUTH_CLIENTS,
    where: { clientId: { equals: clientId } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const doc = docs[0]
  if (!doc?.clientId) return null
  const agent = typeof doc.agent === 'object' ? doc.agent.id : doc.agent
  return {
    id: doc.id,
    clientId: doc.clientId,
    name: doc.name,
    redirectUris: (doc.redirectUris ?? []).map((row) => row.uri),
    enabled: doc.enabled !== false,
    agentId: agent,
  }
}

/** Whether this account still exists and is an agent: a changed role ends its tokens. */
export async function isAgentAccount(payload: Payload, userId: number): Promise<boolean> {
  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      select: { role: true },
      overrideAccess: true,
    })
    return user.role === ROLES.agent
  } catch {
    return false
  }
}
