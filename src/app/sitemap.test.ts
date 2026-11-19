import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The modules are replaced and the data cache passes straight through: this tests the sitemap
const mocks = vi.hoisted(() => ({
  listPageSlugs: vi.fn(),
  listPostSlugs: vi.fn(),
  listEventSlugs: vi.fn(),
  cacheOptions: vi.fn(),
}))
vi.mock('@/modules/site/server', () => ({ listPageSlugs: mocks.listPageSlugs }))
vi.mock('@/modules/news/server', () => ({ listPostSlugs: mocks.listPostSlugs }))
vi.mock('@/modules/events/server', () => ({ listEventSlugs: mocks.listEventSlugs }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keys: string[], options: unknown) => {
    mocks.cacheOptions(keys, options)
    return fn
  },
}))

import sitemap, { dynamic } from './sitemap'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.example')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('sitemap', () => {
  it('lists the listing pages, then every published page, post and event at its address', async () => {
    mocks.listPageSlugs.mockResolvedValue([
      { slug: 'home', updatedAt: '2026-10-01T00:00:00.000Z' },
      { slug: 'about', updatedAt: '2026-10-02T00:00:00.000Z' },
      { slug: '', updatedAt: '2026-10-03T00:00:00.000Z' },
    ])
    mocks.listPostSlugs.mockResolvedValue([
      { slug: 'block-party', updatedAt: '2026-10-04T00:00:00.000Z' },
    ])
    mocks.listEventSlugs.mockResolvedValue([
      { slug: 'fall-cleanup', updatedAt: '2026-10-05T00:00:00.000Z' },
    ])

    const now = '2026-10-22T12:00:00.000Z'
    expect(await sitemap()).toEqual([
      { url: 'https://sprechereast.example/search', lastModified: now },
      { url: 'https://sprechereast.example/posts', lastModified: now },
      { url: 'https://sprechereast.example/events', lastModified: now },
      { url: 'https://sprechereast.example/faq', lastModified: now },
      { url: 'https://sprechereast.example/resources/utilities', lastModified: now },
      { url: 'https://sprechereast.example/resources/government', lastModified: now },
      { url: 'https://sprechereast.example/resources/safety-health', lastModified: now },
      { url: 'https://sprechereast.example/resources/housing-renting', lastModified: now },
      { url: 'https://sprechereast.example/resources/community-family', lastModified: now },
      { url: 'https://sprechereast.example/', lastModified: '2026-10-01T00:00:00.000Z' },
      { url: 'https://sprechereast.example/about', lastModified: '2026-10-02T00:00:00.000Z' },
      {
        url: 'https://sprechereast.example/posts/block-party',
        lastModified: '2026-10-04T00:00:00.000Z',
      },
      {
        url: 'https://sprechereast.example/events/fall-cleanup',
        lastModified: '2026-10-05T00:00:00.000Z',
      },
    ])
  })

  it('leaves out the sign-in, account and confirmation pages, even as CMS page slugs (#280)', async () => {
    const hidden = [
      'login',
      'account',
      'forgot-password',
      'reset-password',
      'sign-up',
      'verify-account',
      'confirm-email',
    ]
    mocks.listPageSlugs.mockResolvedValue(
      [...hidden, 'about'].map((slug) => ({ slug, updatedAt: '2026-10-02T00:00:00.000Z' })),
    )
    mocks.listPostSlugs.mockResolvedValue([])
    mocks.listEventSlugs.mockResolvedValue([])

    const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)

    expect(paths).toContain('/about')
    for (const slug of hidden) expect(paths).not.toContain(`/${slug}`)
  })

  it('escapes a URL for the XML, since Next writes it as it is', async () => {
    mocks.listPageSlugs.mockResolvedValue([])
    mocks.listPostSlugs.mockResolvedValue([
      { slug: 'fish&chips', updatedAt: '2026-10-06T00:00:00.000Z' },
    ])
    mocks.listEventSlugs.mockResolvedValue([])

    const urls = (await sitemap()).map(({ url }) => url)

    expect(urls).toContain('https://sprechereast.example/posts/fish&amp;chips')
  })

  it('caches each list under the tag its save hook expires, for 10 minutes at most', () => {
    for (const tag of ['pages-sitemap', 'posts-sitemap', 'events-sitemap']) {
      expect(mocks.cacheOptions).toHaveBeenCalledWith([tag], { tags: [tag], revalidate: 600 })
    }
  })

  it('renders on request, so the build needs no database and saves show up', () => {
    expect(dynamic).toBe('force-dynamic')
  })
})
