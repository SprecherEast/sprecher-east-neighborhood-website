import React, { type ComponentType, type ReactNode } from 'react'

import type { PageLayoutBlock as LayoutBlock } from '../use-cases/getPageBySlug'
import { SectionBlock } from './SectionBlock'

type BlockOf<T extends LayoutBlock['blockType']> = Extract<LayoutBlock, { blockType: T }>

/**
 * The component that draws each page-builder block type, given the block as the page's layout
 * holds it: site's own blocks as plain props, the others as stored (0013). Blocks come from several
 * modules (the form from contact, the post list and top issues from news, the "this week" strip
 * from events), so the block registry in `src/app/`
 * supplies the map and `RenderBlocks` imports none of them (0008).
 */
export type PageBlockComponents = {
  [T in Exclude<LayoutBlock['blockType'], 'section'>]: ComponentType<
    BlockOf<T> & { disableInnerContainer?: boolean; placement?: 'section' | 'inline' }
  >
}

/**
 * Where a block is drawn: its own band of the page, or a cell of a section block, which owns the
 * space around it (#884).
 */
type Placement = 'section' | 'inline'

/** One block with its component; an unknown block type draws nothing. */
function renderBlock(
  block: LayoutBlock,
  components: PageBlockComponents,
  placement: Placement = 'section',
): ReactNode {
  switch (block.blockType) {
    case 'section':
      // The section draws its items' blocks with the page's own components, as cells
      return (
        <SectionBlock
          items={block.items.map(({ blocks, ...layout }) => ({
            ...layout,
            children: blocks.map((inner, index) => (
              <div key={index}>{renderBlock(inner, components, 'inline')}</div>
            )),
          }))}
        />
      )
    case 'archive':
      return <components.archive {...block} disableInnerContainer placement={placement} />
    case 'content':
      return <components.content {...block} disableInnerContainer placement={placement} />
    case 'cta':
      return <components.cta {...block} disableInnerContainer placement={placement} />
    case 'formBlock':
      return <components.formBlock {...block} disableInnerContainer placement={placement} />
    case 'mapBlock':
      return <components.mapBlock {...block} disableInnerContainer placement={placement} />
    case 'mediaBlock':
      return <components.mediaBlock {...block} disableInnerContainer placement={placement} />
    case 'eventsThisWeek':
      return <components.eventsThisWeek {...block} disableInnerContainer placement={placement} />
    case 'topIssues':
      return <components.topIssues {...block} disableInnerContainer placement={placement} />
    default:
      // A block type added to Pages without a case here fails tsc; an unknown type in old data
      // still draws nothing at runtime
      block satisfies never
      return null
  }
}

/** A page's layout: each block in order, drawn by its component from `components`. */
export const RenderBlocks: React.FC<{
  blocks: LayoutBlock[]
  components: PageBlockComponents
}> = ({ blocks, components }) => {
  if (!Array.isArray(blocks) || blocks.length === 0) return null

  return (
    <>
      {blocks.map((block, index) => {
        const rendered = renderBlock(block, components)
        return rendered ? <div key={index}>{rendered}</div> : null
      })}
    </>
  )
}
