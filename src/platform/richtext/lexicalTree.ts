import type { RichTextValue } from '@/platform/lib'

import { SECTION_TABS_BLOCK_TYPE } from './editorial/blockTypes'

/** The parts of a Lexical node the renderer's helpers read */
export type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  fields?: { blockType?: string; tabs?: { panel?: { root?: LexicalNode } | null }[] }
  children?: LexicalNode[]
}

/** The root of a rich-text value, when it has one */
export const lexicalRoot = (data: RichTextValue | null | undefined): LexicalNode | undefined =>
  (data as unknown as { root?: LexicalNode } | null | undefined)?.root

/**
 * What a node holds, in reading order: its children and, for a section tabs block, the content of
 * each of its tabs (#1333), which is rich text of its own stored in the block's fields. The one
 * place that knows it, so the heading ids and the "On this page" menu see the same headings.
 */
export function nodesWithin(node: LexicalNode): LexicalNode[] {
  if (node.type === 'block' && node.fields?.blockType === SECTION_TABS_BLOCK_TYPE) {
    return (node.fields.tabs ?? []).flatMap((tab) => (tab.panel?.root ? [tab.panel.root] : []))
  }
  return node.children ?? []
}

/** How many nodes in the tree, this one included, match: the one walk the helpers share */
export function countNodes(node: LexicalNode, matches: (node: LexicalNode) => boolean): number {
  return (
    (matches(node) ? 1 : 0) +
    (node.children ?? []).reduce((total, child) => total + countNodes(child, matches), 0)
  )
}

/** How many blocks of one type the tree holds */
export const countBlocksOfType = (node: LexicalNode, blockType: string): number =>
  countNodes(node, (n) => n.type === 'block' && n.fields?.blockType === blockType)
