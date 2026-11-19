import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { MAX_PAGE } from '@/platform/lib'
import { ADMIN_FORGOT_PATH, ADMIN_VERIFY_PREFIX } from '@/platform/payload/adminRoutes'

import { config, isValidPagingPath, proxy } from './proxy'

describe('isValidPagingPath', () => {
  it.each([
    '/posts/page/1',
    `/posts/page/${MAX_PAGE}`,
    '/events/list/upcoming/2',
    '/events/list/past/1',
    '/events/category/civic',
    '/events/category/parks-and-rec/list/upcoming/2',
    '/events/category/family_2026/list/past/1',
  ])('lets %s through', (path) => {
    expect(isValidPagingPath(path)).toBe(true)
  })

  it.each([
    '/posts/page/zz',
    '/posts/page/0',
    '/posts/page/02',
    `/posts/page/${MAX_PAGE + 1}`,
    '/posts/page/2/extra',
    '/events/list/x1/1',
    '/events/list/upcoming/zz',
    '/events/list/upcoming',
    '/events/list/past/1/extra',
    '/events/category/Civic',
    `/events/category/${'a'.repeat(65)}`,
    '/events/category/civic%20events',
    '/events/category/civic/extra',
    '/events/category/civic/list',
    '/events/category/civic/list/x1/1',
    '/events/category/civic/list/upcoming/zz',
    '/events/category/civic/list/upcoming/1/extra',
  ])('rejects %s', (path) => {
    expect(isValidPagingPath(path)).toBe(false)
  })

  it('leaves slug pages and other routes alone', () => {
    // A post titled "Page" has the slug `page`; an event titled "List", `list`.
    expect(isValidPagingPath('/posts/page')).toBe(true)
    expect(isValidPagingPath('/events/list')).toBe(true)
    expect(isValidPagingPath('/posts/some-post')).toBe(true)
    expect(isValidPagingPath('/events')).toBe(true)
    expect(isValidPagingPath('/events/category')).toBe(true)
  })
})

describe('proxy', () => {
  it('answers 404 without rendering for a junk paging URL', () => {
    const response = proxy(new NextRequest('https://sprechereast.example/posts/page/zz'))
    expect(response.status).toBe(404)
  })

  it('sends the admin panel’s forgot-password page to the site’s (#282)', () => {
    const response = proxy(new NextRequest('https://sprechereast.example/admin/forgot'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://sprechereast.example/forgot-password')
  })

  it('sends the admin panel’s verify page to the site’s, with the token (#303)', () => {
    const response = proxy(
      new NextRequest('https://sprechereast.example/admin/users/verify/abc123'),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://sprechereast.example/verify-account?token=abc123',
    )
  })

  it('redirects a junk escape in the admin verify path instead of failing', () => {
    const response = proxy(
      new NextRequest('https://sprechereast.example/admin/users/verify/%E0%A4%A'),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toMatch(/\/verify-account\?token=/)
  })

  it('sends a category filter written as a query to its page (#122)', () => {
    const response = proxy(new NextRequest('https://sprechereast.example/events?category=civic'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://sprechereast.example/events/category/civic',
    )
  })

  it.each(['', 'Civic', '../admin', 'civic/list', 'a'.repeat(65)])(
    'answers 404 for the category query %j',
    (value) => {
      const url = new URL('https://sprechereast.example/events')
      url.searchParams.set('category', value)
      expect(proxy(new NextRequest(url)).status).toBe(404)
    },
  )

  it.each(['/events', '/events?utm_source=newsletter'])(
    'passes %s on to the page when it reaches the proxy',
    (path) => {
      const response = proxy(new NextRequest(`https://sprechereast.example${path}`))
      expect(response.headers.get('x-middleware-next')).toBe('1')
    },
  )

  it('answers 404 for a malformed category page without rendering it', () => {
    const response = proxy(new NextRequest('https://sprechereast.example/events/category/Civic'))
    expect(response.status).toBe(404)
  })

  it('passes a valid paging URL on to the page', () => {
    const response = proxy(new NextRequest('https://sprechereast.example/posts/page/2'))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('matcher', () => {
  it('lists the admin panel’s forgot-password path from the Payload config (#292)', () => {
    expect(config.matcher).toContain(ADMIN_FORGOT_PATH)
  })

  it('lists the admin panel’s verify page from its prefix (#303)', () => {
    expect(config.matcher).toContain(`${ADMIN_VERIFY_PREFIX}:path+`)
  })

  const runsOn = (path: string) =>
    unstable_doesMiddlewareMatch({ config, url: `https://sprechereast.example${path}` })

  it.each([
    '/posts/page/2',
    '/posts/page/zz',
    '/events/list/upcoming/1',
    '/events/list/x1/1',
    '/events/category/civic',
    '/events/category/civic/list/past/2',
    '/events?category=civic',
    '/admin/forgot',
    '/admin/users/verify/abc123',
  ])('runs on %s', (path) => {
    expect(runsOn(path)).toBe(true)
  })

  it.each([
    '/posts/page',
    '/events/list',
    '/posts/some-post',
    '/events',
    '/events?utm_source=newsletter',
    '/events/category',
    '/',
    '/admin',
    '/admin/login',
  ])('does not run on %s', (path) => {
    expect(runsOn(path)).toBe(false)
  })
})
