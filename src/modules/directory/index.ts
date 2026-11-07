// Types and pure rules only, so client components and scripts can import it without pulling in
// React or Payload. Use cases and the components pages render are in server.ts; the collections
// are in cms.ts.
export type { FaqCategory, ResourceCategory } from './domain/categories'
export { RESOURCE_SECTION_NOTES } from './domain/categories'
export { toFaqSections, toResourceSections } from './domain/sections'
