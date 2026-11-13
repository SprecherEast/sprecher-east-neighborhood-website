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
  it('puts a whole tax bill first and holds the tab’s text in its row on why the bill may differ (#1018, #1111)', () => {
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
    present(panel.querySelector('svg[role="img"][aria-label^="Your whole property tax bill"]'))
    expect(panel.querySelector('path[data-pie-slice]')).toBeNull()
    expect(panel.textContent).toContain('Based on the City’s average home.')
    // The tab's own text sits in the panel after the whole bill, inside its closed row
    const text = panel.textContent ?? ''
    expect(text.indexOf('Your whole property tax bill')).toBeLessThan(
      text.indexOf('What the City would spend in 2027'),
    )
    const row = present(
      Array.from(panel.querySelectorAll('details')).find((each) =>
        each.textContent?.includes('What the City would spend in 2027'),
      ),
    )
    expect(row.textContent).toContain('Why your bill may differ')
    expect(row.open).toBe(false)
  })

  it('draws the City’s breakdown once, from the typed home, and its chart by year not at all, in the panel (#1020, #1144)', () => {
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
    // Neither chart is drawn the usual way: one breakdown, and the chart by year only feeds the answer card
    expect(panel.querySelectorAll('[data-amount-part]')).toHaveLength(0)
    expect(panel.querySelectorAll('[data-breakdown-row]')).toHaveLength(1)
    expect(panel.textContent).not.toContain('2027 proposed')
  })

  it('shows how sure we are once, in the answer card, and keeps the tab’s detail in its row (#1111)', () => {
    const [first] = props.tabs
    const tab = present(first)
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
    const shown = {
      tabs: [
        {
          ...tab,
          fact: { ...tab.fact, certainty: 'estimate' as const, detail: 'Why this is only close.' },
          panel: [billShare],
        },
      ],
    }
    const { container } = setup(shown)
    const panel = present(container.querySelector('[role="tabpanel"]'))
    expect(panel.querySelector('[data-panel-certainty]')).toBeNull()
    const answer = present(panel.querySelector('section[aria-label="Your City tax"]'))
    expect(answer.textContent).toContain('Estimate')
    const detail = present(panel.querySelector('[data-panel-detail]'))
    expect(detail.closest('details')?.textContent).toContain('Why your bill may differ')
    expect(panel.querySelectorAll('[data-panel-detail]')).toHaveLength(1)
  })
})
