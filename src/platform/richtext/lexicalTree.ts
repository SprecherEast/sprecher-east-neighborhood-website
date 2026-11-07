import type { RichTextValue } from '@/platform/lib'

/** The parts of a Lexical node the renderer's helpers read */
export type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  fields?: { blockType?: string }
  children?: LexicalNode[]
}

/** The root of a rich-text value, when it has one */
export const lexicalRoot = (data: RichTextValue | null | undefined): LexicalNode | undefined =>
  (data as unknown as { root?: LexicalNode } | null | undefined)?.root

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
