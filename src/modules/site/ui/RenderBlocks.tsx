import React, { type ComponentType, type ReactNode } from 'react'

import type { PageLayoutBlock as LayoutBlock } from '../use-cases/getPageBySlug'

type BlockOf<T extends LayoutBlock['blockType']> = Extract<LayoutBlock, { blockType: T }>

/**
 * The component that draws each page-builder block type, given the block as the page's layout
 * holds it: site's own blocks as plain props, the others as stored (0013). Blocks come from several
 * modules (the form from contact, the post list and top issues from news, the "this week" strip
 * from events), so the block registry in `src/app/`
 * supplies the map and `RenderBlocks` imports none of them (0008).
 */
export type PageBlockComponents = {
  [T in LayoutBlock['blockType']]: ComponentType<BlockOf<T> & { disableInnerContainer?: boolean }>
}

/** One block with its component; an unknown block type draws nothing. */
function renderBlock(block: LayoutBlock, components: PageBlockComponents): ReactNode {
  switch (block.blockType) {
    case 'archive':
      return <components.archive {...block} disableInnerContainer />
    case 'content':
      return <components.content {...block} disableInnerContainer />
    case 'cta':
      return <components.cta {...block} disableInnerContainer />
    case 'formBlock':
      return <components.formBlock {...block} disableInnerContainer />
    case 'mapBlock':
      return <components.mapBlock {...block} disableInnerContainer />
    case 'mediaBlock':
      return <components.mediaBlock {...block} disableInnerContainer />
    case 'eventsThisWeek':
      return <components.eventsThisWeek {...block} disableInnerContainer />
    case 'topIssues':
      return <components.topIssues {...block} disableInnerContainer />
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
