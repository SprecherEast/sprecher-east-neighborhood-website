import type { Block, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { EDITORIAL_BLOCKS, EVENT_RICH_TEXT_BLOCKS, RICH_TEXT_BLOCKS } from '../blockConfigs'

import { FACT_TABS_LIMITS, SECTION_TABS_LIMITS } from './editorialLimits'
import { SECTION_PANEL_BLOCKS, SectionTabsBlockConfig } from './sectionTabsBlockConfig'

const field = (name: string) =>
  (
    (SectionTabsBlockConfig.fields[0] as Field & { fields: Field[] }).fields as (Field & {
      name: string
    })[]
  ).find((f) => f.name === name) as unknown as Record<string, unknown>
const tabs = SectionTabsBlockConfig.fields[0] as unknown as Record<string, unknown>

describe('SectionTabsBlockConfig (#1333)', () => {
  it('is offered in posts and events, after the fact tabs', () => {
    const slugs = (blocks: Block[]) => blocks.map((b) => b.slug)
    expect(slugs(EDITORIAL_BLOCKS).indexOf('sectionTabs')).toBeGreaterThan(
      slugs(EDITORIAL_BLOCKS).indexOf('factTabs'),
    )
    expect(slugs(RICH_TEXT_BLOCKS)).toContain('sectionTabs')
    expect(slugs(EVENT_RICH_TEXT_BLOCKS)).toContain('sectionTabs')
    expect(SectionTabsBlockConfig.interfaceName).toBe('SectionTabsBlock')
  })

  it('takes two to four tabs from the limits, and gives its list an admin config', () => {
    expect(tabs).toMatchObject({
      name: 'tabs',
      minRows: SECTION_TABS_LIMITS.minTabs,
      maxRows: SECTION_TABS_LIMITS.maxTabs,
      required: true,
    })
    expect([SECTION_TABS_LIMITS.minTabs, SECTION_TABS_LIMITS.maxTabs]).toEqual([2, 4])
    // Payload's isRowCollapsed reads `admin` of every list inside a rich-text block
    expect(tabs.admin).toBeTruthy()
  })

  it('keeps a label to one short line, long enough for "Who it affects"', () => {
    expect(field('label')).toMatchObject({ required: true, maxLength: SECTION_TABS_LIMITS.label })
    expect('Who it affects'.length).toBeLessThanOrEqual(SECTION_TABS_LIMITS.label)
    expect(SECTION_TABS_LIMITS.label).toBeLessThanOrEqual(FACT_TABS_LIMITS.label + 2)
  })

  it('holds each tab’s content in a required rich-text field', () => {
    expect(field('panel')).toMatchObject({ type: 'richText', required: true })
  })

  it('offers a tab the article’s blocks, never tabs inside tabs', () => {
    const slugs = SECTION_PANEL_BLOCKS.map((block) => block.slug)
    expect(slugs).toEqual(['timeline', 'steps', 'keyFacts', 'outcomeFork', 'diagramKey', 'figure'])
    expect(slugs).not.toContain('sectionTabs')
  })

  it('writes the block as a Markdown tag and reads one', () => {
    expect(SectionTabsBlockConfig.jsx?.export).toBeTypeOf('function')
    expect(SectionTabsBlockConfig.jsx?.import).toBeTypeOf('function')
  })
})
