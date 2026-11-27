import { OAUTH_PATHS } from './constants'

/**
 * The protected resource (RFC 9728) and the audience of every token (RFC 8707): the MCP address,
 * which clients must spell exactly as the metadata does. A token for any other address, or a
 * client that asks for one, is refused.
 */
export const mcpResource = (origin: string): string =>
  `${origin.replace(/\/+$/, '')}${OAUTH_PATHS.mcp}`

export function resourceMatches(candidate: string | null | undefined, expected: string): boolean {
  return expected !== '' && candidate === expected
}
