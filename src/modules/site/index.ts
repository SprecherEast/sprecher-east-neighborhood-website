// Types and pure rules only, so the proxy, client components and scripts can import it without
// pulling in React or Payload. Use cases and the components pages render are in server.ts; the
// Pages collection, the globals and the layout blocks are in cms.ts.
export { PAGES_SITEMAP_CACHE_TAG } from './domain/cacheTags'
export { FORUM_DEFAULT_URL } from './domain/forum'
