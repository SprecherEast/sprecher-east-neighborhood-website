import 'server-only'

import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { getServerSideURL } from '@/platform/lib/getURL'

import { mcpResource } from '../../domain/oauth/resource'

/** What every OAuth request needs: Payload, this site's address and the MCP address (the audience). */
export async function getOAuthContext(): Promise<{
  payload: Payload
  origin: string
  resource: string
}> {
  const origin = getServerSideURL().replace(/\/+$/, '')
  return { payload: await getPayload({ config: configPromise }), origin, resource: mcpResource(origin) }
}

/** A person's display name for the consent page, or null (never an email address). */
export async function findAccountName(payload: Payload, userId: number): Promise<string | null> {
  try {
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      select: { name: true },
      overrideAccess: true,
    })
    return user.name ?? null
  } catch {
    return null
  }
}
