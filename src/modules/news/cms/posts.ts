import { slugField, type CollectionConfig } from 'payload'
import { draftVersions, previewAdmin, titleField } from '@/platform/payload/contentCollection'
import { TITLE_HEADINGS, articleEditor } from '@/platform/payload/headingsEditor'

import { suggestibleContentAccess } from '@/platform/payload/draftContentAccess'
import { RICH_TEXT_BLOCKS } from '@/platform/richtext/blockConfigs'
import {
  holdSuggestions,
  REVIEW_QUEUE_FIELDS,
  SUGGESTIONS_FILTER,
} from '@/platform/payload/reviewQueue'
import { seoTab } from '@/platform/payload/seoTab'

import { populateAuthors } from './populateAuthors'
import { revalidateDelete, revalidatePost } from './revalidatePost'

export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  defaultSort: '-publishedAt',
  access: suggestibleContentAccess,
  defaultPopulate: {
    title: true,
    slug: true,
    categories: true,
    publishedAt: true,
    meta: {
      image: true,
      description: true,
    },
    // Cards show where the news came from (#483)
    sourceName: true,
    sourceUrl: true,
  },
  admin: {
    components: { beforeListTable: [SUGGESTIONS_FILTER] },
    defaultColumns: ['title', 'slug', '_status', 'moderationStatus', 'updatedAt'],
    ...previewAdmin('posts'),
    useAsTitle: 'title',
  },
  fields: [
    titleField(),
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'content',
              type: 'richText',
              editor: articleEditor(RICH_TEXT_BLOCKS, TITLE_HEADINGS),
              label: false,
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          fields: [
            {
              name: 'relatedPosts',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              filterOptions: ({ id }) => {
                return {
                  id: {
                    not_in: [id],
                  },
                }
              },
              hasMany: true,
              relationTo: 'posts',
            },
            {
              name: 'categories',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              hasMany: true,
              relationTo: 'categories',
            },
          ],
          label: 'Meta',
        },
        seoTab(),
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData._status === 'published' && !value) {
              return new Date()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'authors',
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      hasMany: true,
      relationTo: 'users',
    },
    // This field is only used to populate the user data via the `populateAuthors` hook
    // This is because the `user` collection has access control locked to protect user privacy
    // GraphQL will also not return mutated user data that differs from the underlying schema
    {
      name: 'populatedAuthors',
      type: 'array',
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: 'id',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
    },
    slugField(),
    ...REVIEW_QUEUE_FIELDS,
  ],
  hooks: {
    afterChange: [revalidatePost],
    beforeChange: [holdSuggestions],
    afterRead: [populateAuthors],
    afterDelete: [revalidateDelete],
  },
  versions: draftVersions(50),
}
