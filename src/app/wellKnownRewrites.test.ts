import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { describe, expect, it } from 'vitest'

import nextConfigForPhase, { WELL_KNOWN_REWRITES } from '../../next.config.js'

/**
 * Where the OAuth discovery documents (#1501) answer: the standard addresses under `/.well-known/`,
 * matched the way Next matches them, and nothing else.
 */

const destinationFor = (pathname: string) =>
  WELL_KNOWN_REWRITES.find(({ source }) => getPathMatch(source)(pathname) !== false)?.destination

describe('the OAuth discovery rewrites', () => {
  it.each([
    ['/.well-known/oauth-protected-resource/api/mcp', '/oauth/discovery/protected-resource'],
    ['/.well-known/oauth-authorization-server', '/oauth/discovery/authorization-server'],
  ])('sends %s to %s', (pathname, destination) => {
    expect(destinationFor(pathname)).toBe(destination)
  })

  it.each([
    '/',
    '/.well-known/acme-challenge/token',
    '/.well-known/security.txt',
    '/.well-known/oauth-authorization-server/extra',
    '/.well-known/oauth-protected-resourced',
    // RFC 9728: a document is for the one resource whose path it carries, so no other path gets it
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/',
    '/.well-known/oauth-protected-resource/api/graphql',
    '/.well-known/oauth-protected-resource/api/mcp/extra',
    '/oauth/discovery/protected-resource',
  ])('leaves %s alone', (pathname) => {
    expect(destinationFor(pathname)).toBeUndefined()
  })

  it('is in the config Next reads', async () => {
    const config = nextConfigForPhase('phase-development-server') as {
      rewrites: () => Promise<unknown>
    }
    expect(await config.rewrites()).toEqual(WELL_KNOWN_REWRITES)
  })
})
