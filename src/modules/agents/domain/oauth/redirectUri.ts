/**
 * Redirect addresses for OAuth clients (#1501). A code is only ever sent to an address an admin
 * registered by hand, so these rules decide whether an address may be registered, and whether the
 * one a client sends is one of them. Threat: an attacker's address receiving a code.
 */

import type { OAuthClient } from './types'

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', '[::1]', 'localhost'])

/** `null` when the address may be registered, otherwise why not (shown to the admin). */
export function checkRegisteredRedirectUri(uri: string): string | null {
  if (uri.includes('*')) return 'No wildcards: register each address in full.'
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return 'Enter a full address, such as https://claude.ai/api/mcp/auth_callback.'
  }
  if (url.hash || uri.includes('#')) return 'An address cannot have a # part.'
  if (url.username || url.password) return 'An address cannot hold a username or password.'
  if (url.protocol === 'https:') return uri.slice(8).includes('/') ? null : 'Add the path.'
  if (url.protocol === 'http:') {
    return LOOPBACK_HOSTS.has(url.hostname)
      ? null
      : 'Plain http is only for this computer (127.0.0.1, localhost or [::1]); use https.'
  }
  return 'Use an https address.'
}

/**
 * Whether this client may be sent this redirect address: it is registered, switched on, and the
 * address is one of its own. The one place both pages and the approval decide it (#1501).
 */
export function clientAccepts(
  client: OAuthClient | null,
  redirectUri: string,
): client is OAuthClient {
  return client !== null && client.enabled && redirectUriMatches(client.redirectUris, redirectUri)
}

const parse = (uri: string): URL | null => {
  try {
    return new URL(uri)
  } catch {
    return null
  }
}

/**
 * Whether `requested` is one of the `registered` addresses. Exact text, with one exception the
 * standard allows (RFC 8252, section 7.3): an app on the same computer takes any free port, so a
 * registered `http` loopback address matches the same scheme, host, path and query on any port.
 */
export function redirectUriMatches(registered: readonly string[], requested: string): boolean {
  if (registered.includes(requested)) return true
  const asked = parse(requested)
  if (!asked || !LOOPBACK_HOSTS.has(asked.hostname)) return false
  // Written the one plain way, so no other spelling (`http:host`, a fragment, a username) passes
  if (requested !== `http://${asked.host}${asked.pathname}${asked.search}`) return false
  return registered.some((uri) => {
    const own = parse(uri)
    return (
      own !== null &&
      own.protocol === 'http:' &&
      own.hostname === asked.hostname &&
      own.pathname === asked.pathname &&
      own.search === asked.search
    )
  })
}
