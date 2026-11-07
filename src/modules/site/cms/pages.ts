import type { Block, CollectionConfig } from 'payload'
import { draftVersions, previewAdmin, titleField } from '@/platform/payload/contentCollection'
import { slugField } from 'payload'

import { populatePublishedAt } from '@/platform/payload/populatePublishedAt'
import { draftContentAccess } from '@/platform/payload/draftContentAccess'
import { seoTab } from '@/platform/payload/seoTab'

import { hero } from './hero'
import { revalidateDelete, revalidatePage } from './revalidatePage'

/**
 * The Pages collection. `payload.config.ts` passes in the page-builder blocks: the site's own
 * (`SITE_LAYOUT_BLOCKS`) and other modules' (the contact form), so site imports no module (0008).
 */
export const createPagesCollection = ({
  layoutBlocks,
}: {
  layoutBlocks: Block[]
}): CollectionConfig<'pages'> => ({
  slug: 'pages',
  access: draftContentAccess,
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    ...previewAdmin('pages'),
    useAsTitle: 'title',
  },
  fields: [
    titleField(),
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: layoutBlocks,
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: 'Content',
        },
        seoTab(),
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'backdrop',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'An optional photo shown faded and grayed behind the whole page, under its text. Pick a wide, level photo with a quiet sky or field; the text stays readable in light and dark.',
        position: 'sidebar',
      },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [populatePublishedAt],
    afterDelete: [revalidateDelete],
  },
  versions: draftVersions(50),
})
