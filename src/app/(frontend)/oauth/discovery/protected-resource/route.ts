import { DISCOVERY_HEADERS, protectedResourceMetadata } from '@/modules/agents'
import { getServerSideURL } from '@/platform/lib/getURL'

/**
 * Served at `/.well-known/oauth-protected-resource/api/mcp`, the resource's path added to the
 * well-known name as RFC 9728 says, by the rewrite in `next.config.js`. No other path under it is
 * served, because the document names the resource it is fetched for.
 * What an MCP client reads after a 401 from the AI agent address (RFC 9728, #1501): the address
 * itself and where to sign in. Public, so any client may read it.
 */
export function GET(): Response {
  return Response.json(protectedResourceMetadata(getServerSideURL()), {
    headers: DISCOVERY_HEADERS,
  })
}
