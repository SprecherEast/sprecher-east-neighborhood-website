import type { CollectionConfig } from 'payload'

import { draftContentAccess } from '@/platform/payload/draftContentAccess'
import { populatePublishedAt } from '@/platform/payload/populatePublishedAt'

import { FAQ_CATEGORIES } from '../domain/categories'
import { orderField } from './orderField'
import { revalidateListPage } from './revalidateListPage'

const revalidate = revalidateListPage('faq')

export const FAQ: CollectionConfig<'faq'> = {
  slug: 'faq',
  defaultSort: 'order',
  access: draftContentAccess,
  admin: {
    defaultColumns: ['question', 'category', 'order', '_status', 'updatedAt'],
    useAsTitle: 'question',
  },
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
    },
    {
      name: 'answer',
      type: 'richText',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      options: [...FAQ_CATEGORIES],
      defaultValue: 'general',
    },
    orderField(),
    {
      name: 'publishedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
  ],
  hooks: {
    afterChange: [revalidate.afterChange],
    beforeChange: [populatePublishedAt],
    afterDelete: [revalidate.afterDelete],
  },
  versions: {
    drafts: true,
  },
}
