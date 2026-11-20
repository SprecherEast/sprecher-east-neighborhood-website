import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'

import { toSectionTabsProps, type StoredSectionTabs } from './sectionTabs'

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
