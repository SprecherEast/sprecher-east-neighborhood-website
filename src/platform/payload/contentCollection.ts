import type { CollectionConfig, Field } from 'payload'

import { generatePreviewPath } from './generatePreviewPath'

type PreviewCollection = Parameters<typeof generatePreviewPath>[0]['collection']

/**
 * The admin settings that open a post, event or page's real page from its draft: the Preview
 * button and Live Preview (refreshed on autosave) both go to the same address. Spread into the
 * collection's `admin`. A document with no slug yet has no preview.
 */
export const previewAdmin = (
  collection: PreviewCollection,
): Pick<NonNullable<CollectionConfig['admin']>, 'livePreview' | 'preview'> => ({
  livePreview: {
    url: ({ data, req }) => generatePreviewPath({ slug: data?.slug, collection, req }),
  },
  preview: (data, { req }) =>
    generatePreviewPath({
      slug: typeof data?.slug === 'string' ? data.slug : undefined,
      collection,
      req,
    }),
})

/**
 * Draft and publish for a content collection: autosave (the interval keeps Live Preview fresh)
 * and scheduled publishing, with this many versions kept per document.
 */
export const draftVersions = (maxPerDoc: number): NonNullable<CollectionConfig['versions']> => ({
  drafts: { autosave: { interval: 100 }, schedulePublish: true },
  maxPerDoc,
})

/** The title every content collection starts with. */
export const titleField = (): Field => ({ name: 'title', type: 'text', required: true })
