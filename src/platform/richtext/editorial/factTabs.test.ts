import { afterEach, describe, expect, it, vi } from 'vitest'

import { toKeyFactsProps } from './keyFacts'
import { toFactTabsProps, type StoredFactTabs } from './factTabs'
import { FACT_TABS_FIXTURE } from './factTabsFixtures'

afterEach(() => vi.restoreAllMocks())

const tab = (extra: Record<string, unknown> = {}) => ({
  value: '$1M',
  label: 'Cost',
  icon: 'money',
  certainty: 'confirmed',
  heading: 'Cost',
  definition: 'What it costs.',
  panel: [
    { blockType: 'timeline', entries: [{ date: 'Now', status: 'next', title: 'It starts' }] },
  ],
  ...extra,
})
const stored = (...tabs: Record<string, unknown>[]) => ({ tabs }) as unknown as StoredFactTabs

describe('toFactTabsProps', () => {
  it('reads each tab’s fact the way the key facts block does', () => {
    const { tabs } = toFactTabsProps(FACT_TABS_FIXTURE)
    expect(tabs).toHaveLength(4)
    for (const [index, shown] of tabs.entries()) {
      const source = FACT_TABS_FIXTURE.tabs?.[index]
      expect(shown.fact).toEqual(toKeyFactsProps({ facts: [source ?? {}] }).facts[0])
    }
    expect(tabs[0]?.fact).toMatchObject({ value: '$477.5M', icon: 'money', certainty: 'confirmed' })
    expect(tabs[0]?.fact.source?.external).toBe(true)
  })

  it('turns charts into specs and timelines into entries', () => {
    const { tabs } = toFactTabsProps(FACT_TABS_FIXTURE)
    expect(tabs[0]?.panel.map((item) => item.kind)).toEqual(['chart', 'chart'])
    expect(tabs[1]?.panel[0]).toMatchObject({ kind: 'chart', spec: { kind: 'stacked' } })
    const last = tabs[3]?.panel[0]
    expect(last).toMatchObject({ kind: 'timeline' })
    expect(last?.kind === 'timeline' && last.timeline.entries.map((e) => e.status)).toEqual([
      'done',
      'next',
      'conditional',
      'later',
    ])
  })

  it('leaves out a chart that fails its rules, says why, and keeps the tab’s text', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = tab({ panel: [{ blockType: 'chart', kind: 'bar', title: '', bars: [] }] })
    const { tabs } = toFactTabsProps(stored(broken))
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ heading: 'Cost', definition: 'What it costs.', panel: [] })
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/chart left out/i))
  })

  it('keeps the other picture when one is left out', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const panel = [{ blockType: 'chart', kind: 'bar' }, tab().panel[0]]
    expect(toFactTabsProps(stored(tab({ panel }))).tabs[0]?.panel).toHaveLength(1)
  })

  it('drops a timeline with no milestone and a tab with no value or label', () => {
    const emptyTimeline = [{ blockType: 'timeline', entries: [] }]
    expect(toFactTabsProps(stored(tab({ panel: emptyTimeline }))).tabs[0]?.panel).toEqual([])
    expect(
      toFactTabsProps(stored(tab(), tab({ value: ' ' }), tab({ label: '' }))).tabs,
    ).toHaveLength(1)
  })

  it('falls back to the fact’s label for an empty heading, and reads a missing panel as none', () => {
    const shown = toFactTabsProps(stored(tab({ heading: ' ', panel: undefined }))).tabs[0]
    expect(shown).toMatchObject({ heading: 'Cost', panel: [] })
  })

  it('has no tabs for a block with none', () => {
    expect(toFactTabsProps({}).tabs).toEqual([])
    expect(toFactTabsProps({ tabs: undefined }).tabs).toEqual([])
  })

  it('reads a link the site cannot use as no source', () => {
    const shown = toFactTabsProps(stored(tab({ linkLabel: 'x', linkUrl: 'javascript:alert(1)' })))
    expect(shown.tabs[0]?.fact.source).toBeNull()
  })
})
