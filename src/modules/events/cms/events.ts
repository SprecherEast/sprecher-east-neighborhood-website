import { slugField, type CollectionConfig } from 'payload'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

import { suggestibleContentAccess } from '@/platform/payload/draftContentAccess'
import { EVENT_RICH_TEXT_BLOCKS } from '@/platform/richtext/blockConfigs'
import { generatePreviewPath } from '@/platform/payload/generatePreviewPath'
import { populatePublishedAt } from '@/platform/payload/populatePublishedAt'
import {
  holdSuggestions,
  REVIEW_QUEUE_FIELDS,
  SUGGESTIONS_FILTER,
} from '@/platform/payload/reviewQueue'
import { seoTab } from '@/platform/payload/seoTab'

import { EVENT_LOCATION_TYPES } from '../domain/locationTypes'
import { officialMeetingFields } from './officialMeetingFields'
import { revalidateDelete, revalidateEvent } from './revalidateEvent'

export const Events: CollectionConfig<'events'> = {
  slug: 'events',
  access: suggestibleContentAccess,
  defaultPopulate: {
    title: true,
    slug: true,
    date: true,
    timeStart: true,
    timeEnd: true,
    categories: true,
    description: true,
    locationName: true,
    heroImage: true,
    meta: {
      title: true,
      description: true,
    },
  },
  admin: {
    components: { beforeListTable: [SUGGESTIONS_FILTER] },
    defaultColumns: ['title', 'date', 'categories', '_status', 'moderationStatus', 'updatedAt'],
    // The real event page from the draft, with its card on top, as for posts (#363)
    livePreview: {
      url: ({ data, req }) => generatePreviewPath({ slug: data?.slug, collection: 'events', req }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: typeof data?.slug === 'string' ? data.slug : undefined,
        collection: 'events',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Event Details',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'date',
                  type: 'date',
                  required: true,
                  admin: {
                    date: { pickerAppearance: 'dayOnly' },
                    width: '33%',
                  },
                },
                {
                  name: 'timeStart',
                  type: 'text',
                  admin: { width: '33%', placeholder: '6:00 PM' },
                },
                {
                  name: 'timeEnd',
                  type: 'text',
                  admin: { width: '33%', placeholder: '8:00 PM' },
                },
              ],
            },
            {
              name: 'cancelled',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'A cancelled event stays listed and is marked as cancelled.' },
            },
            officialMeetingFields,
            {
              name: 'featured',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Featured events appear prominently on the homepage' },
            },
            {
              name: 'locationType',
              type: 'select',
              options: [...EVENT_LOCATION_TYPES],
              defaultValue: 'in-person',
            },
            {
              name: 'locationName',
              type: 'text',
              admin: {
                condition: (data) => data?.locationType !== 'virtual',
                placeholder: 'e.g., Sprecher East Park Shelter',
              },
            },
            {
              name: 'locationAddress',
              type: 'text',
              admin: {
                condition: (data) => data?.locationType !== 'virtual',
                placeholder: 'e.g., 4605 Sprecher Rd, Madison, WI 53718',
              },
            },
            {
              name: 'mapsUrl',
              type: 'text',
              admin: {
                condition: (data) => data?.locationType !== 'virtual',
                placeholder: 'Google Maps link',
              },
            },
            {
              name: 'registrationUrl',
              type: 'text',
              admin: { placeholder: 'Registration link (optional)' },
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
          ],
        },
        {
          label: 'Content',
          fields: [
            {
              name: 'description',
              type: 'textarea',
              admin: { description: 'Short description shown in event cards' },
            },
            {
              name: 'content',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                    BlocksFeature({ blocks: EVENT_RICH_TEXT_BLOCKS }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                    UnorderedListFeature(),
                    OrderedListFeature(),
                  ]
                },
              }),
              label: 'Full Event Description',
            },
          ],
        },
        seoTab(),
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        position: 'sidebar',
      },
    },
    {
      // The same category tree as posts, subcategories included (#362)
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    slugField(),
    ...REVIEW_QUEUE_FIELDS,
  ],
  hooks: {
    afterChange: [revalidateEvent],
    beforeChange: [holdSuggestions, populatePublishedAt],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: { interval: 100 },
      schedulePublish: true,
    },
    maxPerDoc: 25,
  },
}
