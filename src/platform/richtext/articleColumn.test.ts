import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'
import { READING_COLUMN } from '@/platform/ui/layoutSizes'

import { articleColumnClass, hasWideBlocks, splitLeadingWideBlocks } from './articleColumn'

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

describe('splitLeadingWideBlocks (#1023)', () => {
  const heading = { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Facts' }] }
  const kinds = (value: unknown) =>
    ((value as { root: { children: { type: string }[] } }).root.children ?? []).map((n) => n.type)

  it('leaves an article that does not open with a card row whole', () => {
    const data = doc(paragraph, block('keyFacts'))
    const { lead, rest } = splitLeadingWideBlocks(data)

    expect(lead).toBeNull()
    expect(rest).toBe(data)
  })

  it('takes the card rows an article opens with, so the picture can start after them', () => {
    const { lead, rest } = splitLeadingWideBlocks(
      doc(block('keyFacts'), block('factTabs'), paragraph, block('keyFacts')),
    )

    expect(kinds(lead)).toEqual(['block', 'block'])
    expect(kinds(rest)).toEqual(['paragraph', 'block'])
  })

  it('takes a heading that introduces the opening card row, but not one that follows it', () => {
    const { lead, rest } = splitLeadingWideBlocks(
      doc(heading, block('keyFacts'), heading, paragraph),
    )

    expect(kinds(lead)).toEqual(['heading', 'block'])
    expect(kinds(rest)).toEqual(['heading', 'paragraph'])
  })

  it('keeps the very same nodes, so heading ids can still come from the whole article', () => {
    const data = doc(heading, block('keyFacts'), heading)
    const children = (data as unknown as { root: { children: object[] } }).root.children
    const { lead, rest } = splitLeadingWideBlocks(data)

    expect((lead as unknown as { root: { children: object[] } }).root.children[0]).toBe(children[0])
    expect((rest as unknown as { root: { children: object[] } }).root.children[0]).toBe(children[2])
  })

  it('takes nothing from an empty or missing document', () => {
    expect(splitLeadingWideBlocks(null).lead).toBeNull()
    expect(splitLeadingWideBlocks(doc()).lead).toBeNull()
  })
})
