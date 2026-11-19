/**
 * Whether the component gallery exists (#466). Only under `next dev`: a production build, a test
 * run and anything else answer 404, so the page never ships to residents or search engines.
 */
export const isGalleryEnabled = (): boolean => process.env.NODE_ENV === 'development'
