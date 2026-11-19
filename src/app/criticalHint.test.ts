import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { describe, expect, it } from 'vitest'

import nextConfigForPhase from '../../next.config.js'

/** The headers the real config (Payload's included) adds for this path, matched the way Next does. */
const headersFor = async (pathname: string) => {
  const config = nextConfigForPhase('phase-development-server')
  const entries = await config.headers()
  return entries
    .filter(({ source }: { source: string }) => getPathMatch(source)(pathname) !== false)
    .flatMap(({ headers }: { headers: { key: string }[] }) => headers.map(({ key }) => key))
}

describe('Critical-CH reaches only the admin (#1309)', () => {
  it.each([
    '/',
    '/events',
    '/posts/the-council-votes-on-the-2027-city-budget-nov-10',
    '/api/users',
  ])('does not make Chrome reload the page %s, which drops its #fragment', async (pathname) => {
    expect(await headersFor(pathname)).not.toContain('Critical-CH')
  })

  it.each(['/admin', '/admin/collections/posts'])('keeps it for %s', async (pathname) => {
    expect(await headersFor(pathname)).toContain('Critical-CH')
  })
})
