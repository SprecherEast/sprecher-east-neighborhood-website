import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'

import { pairsFigureWithBlock, toSectionTabsProps, type StoredSectionTabs } from './sectionTabs'

const block = (blockType: string) => ({ type: 'block', fields: { blockType } })
const para = { type: 'paragraph', children: [{ type: 'text', text: 'x' }] }
const withChildren = (...children: unknown[]) =>
  ({ root: { type: 'root', version: 1, children } }) as unknown as RichTextValue

describe('pairsFigureWithBlock', () => {
  it('is true when a figure is directly followed by a block that is not text, such as a key', () => {
    expect(pairsFigureWithBlock(withChildren(para, block('figure'), block('diagramKey')))).toBe(
      true,
    )
    expect(pairsFigureWithBlock(withChildren(block('figure'), block('timeline'), para))).toBe(true)
  })

  it('is false when text follows the figure, so the text wraps beside it as usual', () => {
    expect(pairsFigureWithBlock(withChildren(block('figure'), para, block('diagramKey')))).toBe(
      false,
    )
  })

  it('is false for a figure last, two figures in a row, or no figure at all', () => {
    expect(pairsFigureWithBlock(withChildren(para, block('figure')))).toBe(false)
    expect(pairsFigureWithBlock(withChildren(block('figure'), block('figure')))).toBe(false)
    expect(pairsFigureWithBlock(withChildren(block('keyFacts'), para))).toBe(false)
    expect(pairsFigureWithBlock(null)).toBe(false)
  })
})

const panel = (text: string) =>
  ({
    root: {
      type: 'root',
      version: 1,
      children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
    },
  }) as unknown as RichTextValue

const empty = {
  root: { type: 'root', version: 1, children: [] },
} as unknown as RichTextValue

describe('toSectionTabsProps', () => {
  it('keeps each tab’s label, trimmed, and its panel as stored, in order', () => {
    const one = panel('One')
    const two = panel('Two')
    const stored = {
      tabs: [
        { label: '  Overview ', panel: one },
        { label: 'The plan', panel: two },
      ],
    } as unknown as StoredSectionTabs
    expect(toSectionTabsProps(stored)).toEqual({
      tabs: [
        { label: 'Overview', panel: one },
        { label: 'The plan', panel: two },
      ],
    })
  })

  it('leaves out a tab with no label, since its button would be blank', () => {
    const props = toSectionTabsProps({
      tabs: [
        { label: '   ', panel: panel('Nameless') },
        { label: 'Kept', panel: panel('Kept') },
      ],
    } as unknown as StoredSectionTabs)
    expect(props.tabs.map((tab) => tab.label)).toEqual(['Kept'])
  })

  it('leaves out a tab with no content, so a reader never opens an empty box', () => {
    const props = toSectionTabsProps({
      tabs: [
        { label: 'Empty', panel: empty },
        { label: 'Missing', panel: null },
        { label: 'Kept', panel: panel('Kept') },
      ],
    } as unknown as StoredSectionTabs)
    expect(props.tabs.map((tab) => tab.label)).toEqual(['Kept'])
  })

  it('reads a block with no tabs as no tabs', () => {
    expect(toSectionTabsProps({})).toEqual({ tabs: [] })
  })
})
