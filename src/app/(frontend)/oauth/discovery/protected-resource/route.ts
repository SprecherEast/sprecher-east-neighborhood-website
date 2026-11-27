import { protectedResourceMetadata } from '@/modules/agents'
import { getServerSideURL } from '@/platform/lib/getURL'

/**
 * Served at `/.well-known/oauth-protected-resource` and, with the resource's path added,
 * `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728), by the rewrites in `next.config.js`.
 * What an MCP client reads after a 401 from the AI agent address (RFC 9728, #1501): the address
 * itself and where to sign in. Public, so any client may read it.
 */
export function GET(): Response {
  return Response.json(protectedResourceMetadata(getServerSideURL()), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  })
}
