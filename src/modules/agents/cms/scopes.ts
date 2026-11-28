import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import { APIError, type PayloadRequest } from 'payload'

import { getServerSideURL } from '@/platform/lib/getURL'

import { insufficientScopeChallenge } from '../domain/oauth/metadata'
import { firstMissingScope, narrowAccess, toolCallNames, type Scope } from '../domain/scopes'

/** The tools a request calls, read from a copy of its body so the plugin still gets the original. */
async function toolsCalledBy(req: PayloadRequest): Promise<string[]> {
  try {
    const copy = req.clone?.()
    return copy ? toolCallNames(await copy.json()) : []
  } catch {
    // Not a JSON body: the plugin answers it; the narrowed settings below still hold
    return []
  }
}

/**
 * Applies a client's scopes (#1499) to the settings the plugin will serve. Two layers: the
 * settings are rebuilt as the overlap of the scopes and the key's own boxes or the address's
 * options, so a tool outside the scopes is never offered or run; and a call to a tool the scopes
 * do not cover is answered `403` with `insufficient_scope` naming the scope it needs (RFC 6750,
 * MCP scope challenge), instead of the plugin's plain "unknown tool".
 */
export async function applyScopes(
  req: PayloadRequest,
  settings: MCPAccessSettings,
  scopes: readonly Scope[],
): Promise<MCPAccessSettings> {
  const missing = firstMissingScope(await toolsCalledBy(req), scopes)
  if (missing) {
    const headers = new Headers(req.responseHeaders)
    headers.set('WWW-Authenticate', insufficientScopeChallenge(getServerSideURL(), missing))
    req.responseHeaders = headers
    throw new APIError('This AI agent is not allowed to do that.', 403, null, true)
  }
  return {
    id: settings.id,
    user: settings.user,
    ...narrowAccess(settings as Record<string, unknown>, scopes),
  } as MCPAccessSettings
}
