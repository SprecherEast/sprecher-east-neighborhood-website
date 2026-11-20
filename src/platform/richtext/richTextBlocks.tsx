import type { SerializedBlockNode } from '@payloadcms/richtext-lexical'
import React from 'react'

import type { SectionTabsBlock as SectionTabsFields } from '@/payload-types'

import { BannerBlock } from './BannerBlock'
import { CodeBlock } from './CodeBlock'
import { isEnlargeable, toChartSpec } from './editorial/chart'
import { DiagramKey } from './editorial/DiagramKey'
import { FactTabs } from './editorial/FactTabs'
import { toFactTabsProps } from './editorial/factTabs'
import { toDiagramKeyProps } from './editorial/diagramKey'
import { KeyFacts } from './editorial/KeyFacts'
import { toKeyFactsProps } from './editorial/keyFacts'
import { OutcomeFork } from './editorial/OutcomeFork'
import { toOutcomeForkProps } from './editorial/outcomeFork'
import { Steps } from './editorial/Steps'
import { toStepsProps } from './editorial/steps'
import { Timeline } from './editorial/Timeline'
import { toTimelineProps } from './editorial/timeline'
import { FigureBlock, PanelFigureBlock } from './FigureBlock'
import { MediaBlock } from './MediaBlock'
import type { BlockExtras, RichTextBlocks } from './RichText'
import { SectionTabsBlock } from './SectionTabsBlock'
import { Chart } from '@/platform/ui/chart/Chart'
import { READING_WIDTH } from '@/platform/ui/layoutSizes'

type SectionTabsNode = SerializedBlockNode<SectionTabsFields>

/**
 * Section tabs (#1333) draw each tab's content with these same renderers, except that a figure
 * follows the article's picture sizes. Declared as a function with its return type so it can name
 * `richTextBlocks`, which holds it, without the type circling back on itself.
 */
function renderSectionTabs({
  node,
  anchorSource,
}: { node: SectionTabsNode } & BlockExtras): React.ReactElement {
  return (
    <SectionTabsBlock
      {...node.fields}
      className="col-start-2"
      blocks={{
        ...richTextBlocks,
        figure: ({ node: figure }) => <PanelFigureBlock {...figure.fields} />,
        // Beside a floated picture its room is narrow: it asks its own width for its columns
        diagramKey: ({ node: key }) => (
          <DiagramKey columns="fit" {...toDiagramKeyProps(key.fields)} />
        ),
      }}
      anchorSource={anchorSource}
    />
  )
}

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
  figure: ({ node }) => <FigureBlock {...node.fields} />,
  chart: ({ node }) => {
    try {
      return (
        <Chart
          className="col-start-2"
          spec={toChartSpec(node.fields)}
          zoom={isEnlargeable(node.fields)}
        />
      )
    } catch (error) {
      // A chart that fails its rules was not saved through the editor (the field checks refuse
      // it); leave it out rather than break the whole post, and say why in the log
      console.error(`Chart block left out: ${error instanceof Error ? error.message : error}`)
      return null
    }
  },
  factTabs: ({ node }) => <FactTabs className="col-start-2" {...toFactTabsProps(node.fields)} />,
  sectionTabs: renderSectionTabs,
  outcomeFork: ({ node }) => (
    <OutcomeFork className="col-start-2" {...toOutcomeForkProps(node.fields)} />
  ),
} satisfies RichTextBlocks
