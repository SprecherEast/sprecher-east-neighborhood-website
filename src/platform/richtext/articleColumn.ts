import type { RichTextValue } from '@/platform/lib'
import { READING_COLUMN } from '@/platform/ui/layoutSizes'

import {
  FACT_TABS_BLOCK_TYPE,
  KEY_FACTS_BLOCK_TYPE,
  OUTCOME_FORK_BLOCK_TYPE,
} from './editorial/blockTypes'
import { countBlocksOfType, lexicalRoot } from './lexicalTree'

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
 * page also gives it to `ArticlePage`, so the metadata line ends where the text does.
 */
export function articleColumnClass(data: RichTextValue | null | undefined): string | undefined {
  return hasWideBlocks(data) ? undefined : READING_COLUMN
}
