import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { describe, expect, it } from 'vitest'

import nextConfigForPhase, {
  API_HEADERS,
  NO_FRAMING_HEADERS,
  NO_FRAMING_PATHS,
} from '../../next.config.js'

/** The headers next.config.js adds to a response for this path, matched the way Next matches them. */
const headersFor = (pathname: string) =>
  API_HEADERS.filter(({ source }) => getPathMatch(source)(pathname) !== false).flatMap(
    ({ headers }) => headers,
  )

const NOINDEX = { key: 'X-Robots-Tag', value: 'noindex' }

describe('X-Robots-Tag on API answers (#280)', () => {
  it.each([
    '/api/users',
    '/api/users/me',
    '/api/form-submissions',
    '/api/email-confirmations/confirm',
    '/api/posts',
    '/api/media',
    '/api/version',
    '/api/graphql',
  ])('asks search engines not to index %s', (pathname) => {
    expect(headersFor(pathname)).toEqual([NOINDEX])
  })

  it.each(['/api/media/file/street-fair.jpg', '/api/media/file/street-fair-1200x630.webp'])(
    'leaves the upload %s indexable, for image search',
    (pathname) => {
      expect(headersFor(pathname)).toEqual([])
    },
  )

  it.each(['/', '/events', '/posts/block-party', '/media/file/x.jpg'])(
    'adds nothing to the page %s',
    (pathname) => {
      expect(headersFor(pathname)).toEqual([])
    },
  )
})

/** The headers the whole config sends for this path: its own, Payload's and the admin-only hint. */
const sentFor = async (pathname: string) => {
  const config = nextConfigForPhase('phase-development-server') as {
    headers: () => Promise<
      Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    >
  }
  return (await config.headers())
    .filter(({ source }) => getPathMatch(source)(pathname) !== false)
    .flatMap(({ headers }) => headers)
}

describe('no framing of the account page (decision 0021)', () => {
  it('lists the account page, and sends frame-ancestors none for each listed path', () => {
    expect(NO_FRAMING_PATHS).toContain('/account')
    for (const { source, headers } of NO_FRAMING_HEADERS) {
      expect(NO_FRAMING_PATHS).toContain(source)
      expect(headers).toEqual([{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }])
    }
  })

  it('reaches /account in the config Next reads, once, and no other page or API route', async () => {
    const csp = (await sentFor('/account')).filter((h) => h.key === 'Content-Security-Policy')
    expect(csp).toEqual([{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }])
    for (const pathname of ['/', '/events', '/login', '/account-help', '/api/users', '/admin']) {
      const sent = (await sentFor(pathname)).filter((h) => h.key === 'Content-Security-Policy')
      expect(sent, pathname).toEqual([])
    }
  })
})
