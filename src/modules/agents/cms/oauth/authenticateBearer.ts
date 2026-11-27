import type { MCPAccessSettings, MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { type PayloadRequest, UnauthorizedError } from 'payload'

import { hasAgent } from '@/platform/payload/roles'

import { OAUTH_TOKENS } from '../../domain/oauth/constants'
import { toCredential } from '../../domain/oauth/credentialRow'
import { hashToken } from '../../domain/oauth/secrets'
import { checkToken } from '../../domain/oauth/tokens'

/** Payload's own name for a slug in an API key's boxes: `agent-runs` becomes `agentRuns`. */
const camel = (slug: string) =>
  slug.replace(/[-_\s]+(.)?/g, (_, chr: string) => (chr ? chr.toUpperCase() : ''))

const ALL = { find: true, create: true, update: true, delete: true }

/**
 * What an OAuth token may reach: everything the plugin's options offer an agent, as an API key
 * with every box ticked would. The agent account's collection access still decides what each tool
 * can do, so this is a ceiling and never more than a key has. Narrower per-client access: #1499.
 */
export function accessFromOptions(options: MCPPluginConfig): Record<string, unknown> {
  const collections = Object.entries(options.collections ?? {}).map(([slug, config]) => [
    camel(slug),
    config.enabled === true ? ALL : config.enabled,
  ])
  const tools = (options.mcp?.tools ?? []).map((tool) => [camel(tool.name), true])
  return { ...Object.fromEntries(collections), 'payload-mcp-tool': Object.fromEntries(tools) }
}

/**
 * Settings for a request that carries one of our access tokens (#1501), or Unauthorized. The
 * token's HMAC is looked up; it must be an access token, live, unrevoked, issued for this MCP
 * address (the audience, checked on every call), and from a client that is still switched on; and
 * the agent account it acts as must still exist and still be an agent. Every refusal is the same
 * 401, so nothing says which check failed.
 */
export async function authenticateOAuth(
  req: PayloadRequest,
  token: string,
  resource: string,
  options: MCPPluginConfig,
): Promise<MCPAccessSettings> {
  const { docs } = await req.payload.find({
    collection: OAUTH_TOKENS,
    where: { tokenHash: { equals: hashToken(token, req.payload.secret) } },
    limit: 1,
    depth: 1,
    pagination: false,
    populate: { 'oauth-clients': { clientId: true, enabled: true } },
    overrideAccess: true,
  })
  const credential = docs[0] ? toCredential(docs[0]) : null
  if (!credential || checkToken(credential, { kind: 'access', resource, now: new Date() })) {
    throw new UnauthorizedError()
  }
  const account = await req.payload
    .findByID({ collection: 'users', id: credential.agentId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!account || !hasAgent(account)) throw new UnauthorizedError()
  return {
    // Rate limits count per client, as they count per key
    id: `oauth-client-${credential.client.id}`,
    user: { ...account, collection: 'users', _strategy: 'mcp-oauth' },
    ...accessFromOptions(options),
  } as MCPAccessSettings
}
