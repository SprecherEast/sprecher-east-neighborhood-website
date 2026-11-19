import type { Block, Field } from 'payload'

import { MediaBlock } from '@/platform/richtext/blockConfigs'

import { Content } from './contentBlock'
import { MapBlock } from './mapBlock'

/**
 * The blocks a section item may hold. A band or a form is its own row of the page, so it stays
 * out of a cell; the Section itself stays out too, so layouts don't nest without end.
 */
export const SECTION_ITEM_BLOCKS: Block[] = [Content, MediaBlock, MapBlock]

const choice = (label: string, value: string) => ({ label, value })

const itemFields: Field[] = [
  {
    name: 'width',
    type: 'select',
    defaultValue: 'full',
    required: true,
    admin: {
      description:
        'How much of the row this item takes on a large screen. Items that add up to more than a row move to the next one. On a phone every item is full width.',
    },
    options: [
      choice('Full', 'full'),
      choice('Three quarters', 'threeQuarters'),
      choice('Two thirds', 'twoThirds'),
      choice('Half', 'half'),
      choice('One third', 'oneThird'),
      choice('One quarter', 'quarter'),
    ],
  },
  {
    name: 'align',
    type: 'select',
    defaultValue: 'start',
    required: true,
    label: 'Text alignment',
    options: [choice('Left', 'start'), choice('Center', 'center'), choice('Right', 'end')],
  },
  {
    name: 'verticalAlign',
    type: 'select',
    defaultValue: 'top',
    required: true,
    label: 'Vertical position',
    admin: { description: 'Where the item sits beside a taller item in the same row.' },
    options: [choice('Top', 'top'), choice('Middle', 'center'), choice('Bottom', 'bottom')],
  },
  {
    name: 'phoneOrder',
    type: 'select',
    defaultValue: 'inOrder',
    required: true,
    label: 'On a phone',
    admin: { description: 'Where this item shows when the items stack on a phone.' },
    options: [
      choice('In the order listed', 'inOrder'),
      choice('Above the other items', 'first'),
      choice('Below the other items', 'last'),
    ],
  },
  {
    name: 'content',
    type: 'blocks',
    label: 'Content',
    blocks: SECTION_ITEM_BLOCKS,
    admin: { initCollapsed: true },
  },
]

/**
 * A section of the page the editor lays out (#884): a row of items, each with its own width,
 * alignment, position and phone order, holding the blocks inside. Layout is a field, so changing
 * it needs no code change and no deploy.
 */
export const SectionBlock: Block = {
  slug: 'section',
  interfaceName: 'SectionBlock',
  labels: { singular: 'Section', plural: 'Sections' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Item', plural: 'Items' },
      admin: { initCollapsed: false },
      fields: itemFields,
    },
  ],
}
