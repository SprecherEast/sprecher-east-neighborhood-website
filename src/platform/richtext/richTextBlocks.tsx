import React from 'react'

import { BannerBlock } from './BannerBlock'
import { CodeBlock } from './CodeBlock'
import { DiagramKey } from './editorial/DiagramKey'
import { toDiagramKeyProps } from './editorial/diagramKey'
import { KeyFacts } from './editorial/KeyFacts'
import { toKeyFactsProps } from './editorial/keyFacts'
import { OutcomeFork } from './editorial/OutcomeFork'
import { toOutcomeForkProps } from './editorial/outcomeFork'
import { Steps } from './editorial/Steps'
import { toStepsProps } from './editorial/steps'
import { Timeline } from './editorial/Timeline'
import { toTimelineProps } from './editorial/timeline'
import { MediaBlock } from './MediaBlock'
import type { RichTextBlocks } from './RichText'
import { READING_WIDTH } from '@/platform/ui/layoutSizes'

/**
 * Renderers for the blocks in `RICH_TEXT_BLOCKS`, for `RichText`'s `blocks` prop.
 * Post and event pages pass this map to RichText; event content offers the media and editorial
 * blocks (`EVENT_RICH_TEXT_BLOCKS`).
 */
export const richTextBlocks = {
  banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" {...node.fields} />,
  mediaBlock: ({ node }) => (
    <MediaBlock {...node.fields} placement="inline" captionClassName={`mx-auto ${READING_WIDTH}`} />
  ),
  code: ({ node }) => <CodeBlock className="col-start-2" {...node.fields} />,
  timeline: ({ node }) => <Timeline className="col-start-2" {...toTimelineProps(node.fields)} />,
  steps: ({ node }) => <Steps className="col-start-2" {...toStepsProps(node.fields)} />,
  keyFacts: ({ node }) => <KeyFacts className="col-start-2" {...toKeyFactsProps(node.fields)} />,
  diagramKey: ({ node }) => (
    <DiagramKey className="col-start-2" {...toDiagramKeyProps(node.fields)} />
  ),
  outcomeFork: ({ node }) => (
    <OutcomeFork className="col-start-2" {...toOutcomeForkProps(node.fields)} />
  ),
} satisfies RichTextBlocks
