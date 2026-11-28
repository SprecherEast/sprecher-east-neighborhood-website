import type { MCPAccessSettings, MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { type PayloadRequest, UnauthorizedError } from 'payload'

import { ACCOUNTS_COLLECTION } from '@/platform/lib'
import { hasAgent } from '@/platform/payload/roles'

import { toCredential } from '../../domain/oauth/credentialRow'
import { accountById, credentialByHash, revokedInFamily } from '../../domain/oauth/queries'
import { hashToken } from '../../domain/oauth/secrets'
import { checkToken } from '../../domain/oauth/tokens'
import { effectiveScopes, TOOL_ACCESS_KEY, type Scope } from '../../domain/scopes'

/** Payload's own name for a slug in an API key's boxes: `agent-runs` becomes `agentRuns`. */
const camel = (slug: string) =>
  slug.replace(/[-_\s]+(.)?/g, (_, chr: string) => (chr ? chr.toUpperCase() : ''))

const ALL = { find: true, create: true, update: true, delete: true }

/**
 * What an OAuth token may reach: everything the plugin's options offer an agent, as an API key
 * with every box ticked would. The agent account's collection access still decides what each tool
 * can do, so this is a ceiling and never more than a key has. The client's scopes narrow it
 * further (`cms/scopes.ts`, #1499).
 */
export function accessFromOptions(options: MCPPluginConfig): Record<string, unknown> {
  const collections = Object.entries(options.collections ?? {}).map(([slug, config]) => [
    camel(slug),
    config.enabled === true ? ALL : config.enabled,
  ])
  const tools = (options.mcp?.tools ?? []).map((tool) => [camel(tool.name), true])
  return { ...Object.fromEntries(collections), [TOOL_ACCESS_KEY]: Object.fromEntries(tools) }
}

/**
 * Settings for a request that carries one of our access tokens (#1501), or Unauthorized. The
 * token's HMAC is looked up; it must be an access token, live, unrevoked, issued for this MCP
 * address (the audience, checked on every call), and from a client that is still switched on and not expired; and
 * the agent account it acts as must still exist and still be an agent. Every refusal is the same
 * 401, so nothing says which check failed.
 */
export async function authenticateOAuth(
  req: PayloadRequest,
  token: string,
  resource: string,
  options: MCPPluginConfig,
): Promise<{ settings: MCPAccessSettings; scopes: Scope[] }> {
  const { docs } = await req.payload.find(credentialByHash(hashToken(token, req.payload.secret)))
  const credential = docs[0] ? toCredential(docs[0]) : null
  if (!credential || checkToken(credential, { kind: 'access', resource, now: new Date() })) {
    throw new UnauthorizedError()
  }
  // One revoked row ends the family, so a token saved while the family was ending is refused here
  const ended = await req.payload.find(revokedInFamily(credential.family))
  if (ended.docs.length > 0) throw new UnauthorizedError()
  const account = await req.payload.findByID(accountById(credential.agentId)).catch(() => null)
  if (!account || !hasAgent(account)) throw new UnauthorizedError()
  return {
    settings: {
      // Rate limits count per client, as they count per key
      id: `oauth-client-${credential.client.id}`,
      user: { ...account, collection: ACCOUNTS_COLLECTION, _strategy: 'mcp-oauth' },
      ...accessFromOptions(options),
    } as MCPAccessSettings,
    // The client's record as it is now, so narrowing it applies at once, and what this token was given
    scopes: effectiveScopes(credential.client.scopes, credential.scope),
  }
}
