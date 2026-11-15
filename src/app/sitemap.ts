import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'

import { ACCOUNT_PAGE_PATHS } from '@/modules/accounts'
import { RESOURCE_GROUPS, resourceGroupHref } from '@/modules/directory'
import { EVENTS_SITEMAP_CACHE_TAG } from '@/modules/events'
import { listEventSlugs } from '@/modules/events/server'
import { POSTS_SITEMAP_CACHE_TAG } from '@/modules/news'
import { listPostSlugs } from '@/modules/news/server'
import { PAGES_SITEMAP_CACHE_TAG } from '@/modules/site'
import { listPageSlugs } from '@/modules/site/server'
import { CONFIRM_EMAIL_PATH } from '@/modules/verification'
import { escapeMarkup } from '@/platform/lib'
import { getServerSideURL } from '@/platform/lib/getURL'
import { documentHref } from '@/platform/payload/documentHref'

// Rendered on request, so the build doesn't query the database for it. Each list below stays in
// the data cache until a save expires its tag (the pages, posts and events hooks), or for 10
// minutes: a scheduled publish runs outside a request, where its tag can't be expired (#141,
// decision 0011)
export const dynamic = 'force-dynamic'

const LIST_REFRESH_SECONDS = 600

type Entry = { path: string; lastModified: string }

// The listing pages, which aren't CMS pages, lead the sitemap
const LISTING_PATHS = [
  '/search',
  '/posts',
  '/events',
  '/faq',
  ...RESOURCE_GROUPS.map(({ id }) => resourceGroupHref(id)),
]

// Pages that ask not to be indexed (#280). Their routes win over a CMS page with the same slug,
// so such a page could only ever list the route here: it's left out
const NOT_INDEXED_PATHS = new Set<string>([...ACCOUNT_PAGE_PATHS, CONFIRM_EMAIL_PATH])

const cachedList = (tag: string, list: () => Promise<Entry[]>) =>
  unstable_cache(list, [tag], { tags: [tag], revalidate: LIST_REFRESH_SECONDS })

const pageEntries = cachedList(PAGES_SITEMAP_CACHE_TAG, async () => {
  const now = new Date().toISOString()
  const pages = await listPageSlugs()

  return [
    ...LISTING_PATHS.map((path) => ({ path, lastModified: now })),
    ...pages
      // A page with no slug has no address of its own
      .filter(({ slug }) => Boolean(slug))
      .map(({ slug, updatedAt }) => ({
        path: documentHref('pages', slug),
        lastModified: updatedAt,
      }))
      .filter(({ path }) => !NOT_INDEXED_PATHS.has(path)),
  ]
})

const postEntries = cachedList(POSTS_SITEMAP_CACHE_TAG, async () =>
  (await listPostSlugs()).map(({ slug, updatedAt }) => ({
    path: documentHref('posts', slug),
    lastModified: updatedAt,
  })),
)

const eventEntries = cachedList(EVENTS_SITEMAP_CACHE_TAG, async () =>
  (await listEventSlugs()).map(({ slug, updatedAt }) => ({
    path: documentHref('events', slug),
    lastModified: updatedAt,
  })),
)

/**
 * `/sitemap.xml`: the listing pages, then every published page, post and event. Next writes each
 * URL into the XML as it is, so it's escaped here (a hand-typed slug could hold `&`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getServerSideURL()
  const lists = await Promise.all([pageEntries(), postEntries(), eventEntries()])

  return lists.flat().map(({ path, lastModified }) => ({
    url: escapeMarkup(`${siteUrl}${path}`),
    lastModified,
  }))
}
