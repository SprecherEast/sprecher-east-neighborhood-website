import { OAUTH_PATHS } from './constants'

/**
 * This site's origin without trailing slashes: the one spelling of the issuer (RFC 8414), the `iss`
 * on every redirect back (RFC 9207) and the base of every address here. A client compares them,
 * so they must never differ.
 */
export const siteOrigin = (origin: string): string => origin.replace(/\/+$/, '')

/**
 * The protected resource (RFC 9728) and the audience of every token (RFC 8707): the MCP address,
 * which clients must spell exactly as the metadata does. A token for any other address, or a
 * client that asks for one, is refused.
 */
export const mcpResource = (origin: string): string => `${siteOrigin(origin)}${OAUTH_PATHS.mcp}`

export function resourceMatches(candidate: string | null | undefined, expected: string): boolean {
  return expected !== '' && candidate === expected
}
