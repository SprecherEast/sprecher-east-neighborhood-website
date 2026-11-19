import type { RichTextValue } from '@/platform/lib'
import { READING_COLUMN } from '@/platform/ui/layoutSizes'

import {
  FACT_TABS_BLOCK_TYPE,
  KEY_FACTS_BLOCK_TYPE,
  OUTCOME_FORK_BLOCK_TYPE,
} from './editorial/blockTypes'
import { countBlocksOfType, lexicalRoot, type LexicalNode } from './lexicalTree'

/**
 * The blocks that are rows of cards, not text: they gain from the whole column, and a text line
 * would not (#774). The other blocks read as text or sit small, so they keep the reading width.
 */
const WIDE_BLOCK_TYPES = [FACT_TABS_BLOCK_TYPE, KEY_FACTS_BLOCK_TYPE, OUTCOME_FORK_BLOCK_TYPE]

/** Whether an article's rich text holds a row of cards (key facts, fact tabs, an outcome fork) */
export function hasWideBlocks(data: RichTextValue | null | undefined): boolean {
  const root = lexicalRoot(data)
  return root ? WIDE_BLOCK_TYPES.some((type) => countBlocksOfType(root, type) > 0) : false
}

/**
 * The width class for an article's text (`RichText`'s `className`): the reading width from the
 * column's left edge, so long lines stay comfortable, unless the article holds a row of cards, which
 * fills the column up to the page margin the page menu has on the left (#774). `undefined` leaves
 * `RichText`'s own full width. Post and event pages both use it, so the rule is written once; the
 * page also gives it to `ArticlePage`, so the byline ends on the text's right edge.
 */
export function articleColumnClass(data: RichTextValue | null | undefined): string | undefined {
  return hasWideBlocks(data) ? undefined : READING_COLUMN
}

const isWideBlock = (node: LexicalNode): boolean =>
  node.type === 'block' && WIDE_BLOCK_TYPES.includes(node.fields?.blockType ?? '')

/** A copy of the document holding only these top-level nodes; the nodes themselves are not copied */
const withChildren = (data: RichTextValue, children: LexicalNode[]): RichTextValue => {
  const root = lexicalRoot(data)
  return { ...data, root: { ...root, children } } as unknown as RichTextValue
}

/**
 * An article that opens with a row of cards (and the heading that introduces it) is split there: the
 * `lead` is that opening, the `rest` is the text from then on. The article's picture floats right
 * beside text, but a row of cards runs the whole column and can't sit beside it, so a picture ahead of
 * the cards would leave a blank block beside them (#1023). The page draws the lead, then the picture
 * (`ArticlePage`'s `lead`), then the rest, so the picture starts beside the first text. The nodes are
 * the same objects as in the whole document, so heading ids still come from the whole (`RichText`'s
 * `anchorSource`). `lead` is null when the article doesn't open that way, and `rest` is then the
 * document as given.
 */
export function splitLeadingWideBlocks(data: RichTextValue | null | undefined): {
  lead: RichTextValue | null
  rest: RichTextValue | null | undefined
} {
  const children = lexicalRoot(data)?.children ?? []
  // Headings and card rows open the article; the run ends after the last card row among them
  let end = 0
  for (const [index, node] of children.entries()) {
    if (isWideBlock(node)) end = index + 1
    else if (node.type !== 'heading') break
  }
  if (!data || end === 0) return { lead: null, rest: data }
  return {
    lead: withChildren(data, children.slice(0, end)),
    rest: withChildren(data, children.slice(end)),
  }
}
