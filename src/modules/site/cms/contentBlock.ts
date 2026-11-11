import type { Block, Field } from 'payload'

import { BODY_HEADINGS, headingsEditor } from '@/platform/payload/headingsEditor'

import { link } from '@/platform/payload/link'

const columnFields: Field[] = [
  {
    name: 'size',
    type: 'select',
    defaultValue: 'oneThird',
    options: [
      {
        label: 'One Third',
        value: 'oneThird',
      },
      {
        label: 'Half',
        value: 'half',
      },
      {
        label: 'Two Thirds',
        value: 'twoThirds',
      },
      {
        label: 'Full',
        value: 'full',
      },
    ],
  },
  {
    name: 'richText',
    type: 'richText',
    editor: headingsEditor(BODY_HEADINGS),
    label: false,
  },
  {
    name: 'enableLink',
    type: 'checkbox',
  },
  link({
    appearances: ['default', 'outline', 'accent'],
    overrides: {
      admin: {
        condition: (_data, siblingData) => {
          return Boolean(siblingData?.enableLink)
        },
      },
    },
  }),
  {
    name: 'linkAlign',
    type: 'select',
    label: 'Link button position',
    defaultValue: 'start',
    options: [
      { label: 'Start (left)', value: 'start' },
      { label: 'End (right)', value: 'end' },
      { label: 'Beside the text (right, the text wraps around it)', value: 'beside' },
    ],
    admin: {
      description: 'Where the link button sits in its column.',
      condition: (_data, siblingData) => Boolean(siblingData?.enableLink),
    },
  },
]

export const Content: Block = {
  slug: 'content',
  interfaceName: 'ContentBlock',
  fields: [
    {
      name: 'columns',
      type: 'array',
      admin: {
        initCollapsed: true,
      },
      fields: columnFields,
    },
  ],
}
