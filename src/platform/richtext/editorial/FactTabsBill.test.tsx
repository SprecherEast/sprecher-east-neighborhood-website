// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { present } from '@/platform/payload/testing/present'

import { FactTabs } from './FactTabs'
import { toFactTabsProps } from './factTabs'
import { FACT_TABS_FIXTURE } from './factTabsFixtures'

afterEach(cleanup)

const props = toFactTabsProps(FACT_TABS_FIXTURE)
const setup = (shown = props) => render(<FactTabs {...shown} />)

describe('FactTabs with a whole tax bill', () => {
  it('puts a whole tax bill first and holds the rest of the tab under its City slice (#1018)', () => {
    const [first] = props.tabs
    const billShare = {
      kind: 'billShare' as const,
      billShare: {
        intro: 'Based on the City’s average home.',
        years: [
          {
            year: 2026,
            label: '2026 rates',
            note: '',
            averageHome: 481300,
            rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 },
            source: null,
          },
        ],
      },
    }
    const shown = { tabs: [{ ...present(first), panel: [...present(first).panel, billShare] }] }
    const { container } = setup(shown)
    const panel = present(container.querySelector('[role="tabpanel"]'))
    present(panel.querySelector('svg[role="img"][aria-label^="Your rough property tax"]'))
    expect(panel.textContent).toContain('Based on the City’s average home.')
    // The tab's own text sits in the panel after the pie
    const text = panel.textContent ?? ''
    expect(text.indexOf('Your rough property tax')).toBeLessThan(
      text.indexOf('What the City would spend in 2027'),
    )
  })

  it('draws the City’s stacked chart as one bar and its breakdown from the typed home, in the panel (#1020)', () => {
    const [first] = props.tabs
    const bars = {
      kind: 'chart' as const,
      enlarge: false,
      spec: {
        kind: 'stacked' as const,
        title: 'City tax',
        summary: 'Up.',
        unit: 'usd' as const,
        orientation: 'horizontal' as const,
        x: ['2026 adopted', '2027 proposed'],
        series: [
          { key: 'same', label: 'Same as 2026', values: [3000, 3000] },
          { key: 'more', label: 'Proposed increase', pattern: 'hatch' as const, values: [0, 100] },
        ],
      },
    }
    const breakdown = {
      kind: 'chart' as const,
      enlarge: false,
      spec: {
        kind: 'breakdown' as const,
        title: 'Where that City tax goes, estimated',
        summary: 'Our estimate.',
        unit: 'usd' as const,
        hideSquares: true,
        areas: [{ key: 'a', label: 'Everything', value: 3100 }],
      },
    }
    const billShare = {
      kind: 'billShare' as const,
      billShare: {
        intro: 'Based on the City’s average home.',
        years: [
          {
            year: 2026,
            label: '2026 rates',
            note: '',
            averageHome: 481300,
            rates: { city: 7 },
            source: null,
          },
          {
            year: 2027,
            label: '2027 rates',
            note: '',
            averageHome: 500300,
            rates: { city: 6.93 },
            source: null,
          },
        ],
      },
    }
    const tab = { ...present(first), panel: [billShare, bars, breakdown] }
    const { container } = setup({ tabs: [tab] })
    const panel = present(container.querySelector('[role="tabpanel"]'))
    // The two charts are not drawn a second time the usual way: one bar and one breakdown
    expect(panel.querySelectorAll('[data-amount-part]')).toHaveLength(2)
    expect(panel.querySelectorAll('[data-breakdown-row]')).toHaveLength(1)
    expect(panel.textContent).toContain('2027 proposed')
  })
})
