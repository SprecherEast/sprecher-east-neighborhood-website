import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'
import { READING_COLUMN } from '@/platform/ui/layoutSizes'

import { articleColumnClass, hasWideBlocks } from './articleColumn'

/** A rich-text document holding the given nodes, as the editor saves it */
const doc = (...children: object[]) =>
  ({
    root: { type: 'root', children, direction: null, format: '', indent: 0, version: 1 },
  }) as unknown as RichTextValue

const paragraph = { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }
const block = (blockType: string) => ({ type: 'block', fields: { blockType, id: 'b1' } })

describe('hasWideBlocks', () => {
  it('is false for text, headings and blocks that read as text', () => {
    expect(hasWideBlocks(doc(paragraph, block('timeline'), block('steps'), block('chart')))).toBe(
      false,
    )
  })

  it.each(['factTabs', 'keyFacts', 'outcomeFork'])('is true for a %s block', (blockType) => {
    expect(hasWideBlocks(doc(paragraph, block(blockType)))).toBe(true)
  })

  it('finds a wide block nested inside another node', () => {
    expect(hasWideBlocks(doc({ type: 'quote', children: [block('factTabs')] }))).toBe(true)
  })

  it('is false for an empty or missing document', () => {
    expect(hasWideBlocks(doc())).toBe(false)
    expect(hasWideBlocks(null)).toBe(false)
    expect(hasWideBlocks(undefined)).toBe(false)
  })
})

describe('articleColumnClass', () => {
  it('keeps a text article at the reading width, from the left edge', () => {
    expect(articleColumnClass(doc(paragraph))).toBe(READING_COLUMN)
  })

  it('lets an article with card blocks fill its column', () => {
    expect(articleColumnClass(doc(paragraph, block('factTabs')))).toBeUndefined()
  })
})
