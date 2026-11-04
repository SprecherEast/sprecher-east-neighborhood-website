import type { Block } from 'payload'

import { ChartBlockConfig } from './editorial/chartBlockConfig'
import { DiagramKeyBlockConfig } from './editorial/diagramKeyBlockConfig'
import { FactTabsBlockConfig } from './editorial/factTabsBlockConfig'
import { KeyFactsBlockConfig } from './editorial/keyFactsBlockConfig'
import { OutcomeForkBlockConfig } from './editorial/outcomeForkBlockConfig'
import { StepsBlockConfig } from './editorial/stepsBlockConfig'
import { TimelineBlockConfig } from './editorial/timelineBlockConfig'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

// The Payload configs of the blocks an editor can put inside rich text. Their renderers are in
// richTextBlocks.tsx; the media block is also a page-builder block.

export const Banner: Block = {
  slug: 'banner',
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'info',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
        { label: 'Success', value: 'success' },
      ],
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
      label: false,
      required: true,
    },
  ],
  interfaceName: 'BannerBlock',
}

export const Code: Block = {
  slug: 'code',
  interfaceName: 'CodeBlock',
  fields: [
    {
      name: 'language',
      type: 'select',
      defaultValue: 'typescript',
      options: [
        {
          label: 'Typescript',
          value: 'typescript',
        },
        {
          label: 'Javascript',
          value: 'javascript',
        },
        {
          label: 'CSS',
          value: 'css',
        },
      ],
    },
    {
      name: 'code',
      type: 'code',
      label: false,
      required: true,
    },
  ],
}

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  interfaceName: 'MediaBlock',
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
  ],
}

/**
 * Visual blocks for explainer stories (epic #506): a timeline, steps, key facts, an outcome
 * fork, a diagram key for annotated images, a chart and fact tabs. Post and event content both offer them, in this order.
 */
export const EDITORIAL_BLOCKS: Block[] = [
  TimelineBlockConfig,
  StepsBlockConfig,
  KeyFactsBlockConfig,
  OutcomeForkBlockConfig,
  DiagramKeyBlockConfig,
  ChartBlockConfig,
  FactTabsBlockConfig,
]

/** The blocks a post's content may hold, in the order the editor offers them. */
export const RICH_TEXT_BLOCKS: Block[] = [Banner, Code, MediaBlock, ...EDITORIAL_BLOCKS]

/** The blocks an event's content may hold: images and the visual blocks, no banner or code. */
export const EVENT_RICH_TEXT_BLOCKS: Block[] = [MediaBlock, ...EDITORIAL_BLOCKS]
