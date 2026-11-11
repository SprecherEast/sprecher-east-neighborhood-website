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
    const bar = present(
      panel.querySelector('svg[role="img"][aria-label^="Your whole property tax bill"]'),
    )
    expect(panel.textContent).toContain('Based on the City’s average home.')
    // The tab's own text sits in the panel after the bar
    const afterBar = bar.parentElement?.lastElementChild
    expect(afterBar?.textContent).toContain('What the City would spend in 2027')
  })
})
