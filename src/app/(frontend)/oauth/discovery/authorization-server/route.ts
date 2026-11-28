import { authorizationServerMetadata, discoveryResponse } from '@/modules/agents'
import { getServerSideURL } from '@/platform/lib/getURL'

/**
 * Served at `/.well-known/oauth-authorization-server` by a rewrite in `next.config.js`.
 * The sign-in addresses and what they accept (RFC 8414, #1501): PKCE S256, the code and refresh
 * grants, no open registration. Public, so any client may read it.
 */
export function GET(): Response {
  return discoveryResponse(authorizationServerMetadata(getServerSideURL()))
}
