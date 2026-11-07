// Types and pure rules only, so the proxy, client components and scripts can import it without
// pulling in React or Payload. Use cases and the components pages render are in server.ts; the
// collections and search options are in cms.ts.
export { POSTS_SITEMAP_CACHE_TAG } from './domain/cacheTags'
export { parseSearchQuery } from './domain/search'
