import type { Field } from 'payload'

export const searchFields: Field[] = [
  {
    name: 'slug',
    type: 'text',
    index: true,
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'meta',
    label: 'Meta',
    type: 'group',
    index: true,
    admin: {
      readOnly: true,
    },
    fields: [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
      },
      {
        type: 'text',
        name: 'description',
        label: 'Description',
      },
      {
        name: 'image',
        label: 'Image',
        type: 'upload',
        relationTo: 'media',
      },
    ],
  },
  // Copied from the document so results can show them (#471, #492): whether an event is
  // cancelled, and where a post's or event's news came from
  {
    name: 'cancelled',
    type: 'checkbox',
    defaultValue: false,
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'sourceName',
    type: 'text',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'sourceUrl',
    type: 'text',
    admin: {
      readOnly: true,
    },
  },
  {
    label: 'Categories',
    name: 'categories',
    type: 'array',
    admin: {
      readOnly: true,
    },
    fields: [
      {
        name: 'relationTo',
        type: 'text',
      },
      {
        name: 'categoryID',
        type: 'text',
      },
      {
        name: 'title',
        type: 'text',
      },
    ],
  },
]
