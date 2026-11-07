// Types and pure rules only, so the proxy, client components and scripts can import it without
// pulling in React or Payload. Use cases and the components pages render are in server.ts; the
// collection is in cms.ts.
export { EVENTS_SITEMAP_CACHE_TAG } from './domain/cacheTags'
export { eventListTitle, isCategorySlug } from './domain/filters'
export { isEventScope } from './domain/scope'
