import type { RequiredDataFromCollectionSlug } from 'payload'

import { block, heading, p, root } from '../../src/endpoints/seed/helpers/lexical'
import { FIXTURES } from '../../src/platform/lib/chart/fixtures'
import { parseChartSpec } from '../../src/platform/lib/chart/spec'
import { fromChartSpec } from '../../src/platform/richtext/editorial/chart'
import { FACT_TABS_FIXTURE } from '../../src/platform/richtext/editorial/factTabsFixtures'
import { BILL_POST_SLUG } from './alignmentSlug'

const chart = (name: 'operating' | 'dayToDay') => ({
  blockType: 'chart' as const,
  ...fromChartSpec(parseChartSpec(FIXTURES[name])),
})

/**
 * A post whose one fact tab starts with a whole tax bill (#1118), the City's own two chart kinds
 * after it, so the browser test measures the estimator row, the answer card and the three rows
 * as a page draws them, with text above and below the tabs.
 */
export const billPost = (authorId: number): RequiredDataFromCollectionSlug<'posts'> => ({
  authors: [authorId],
  slug: BILL_POST_SLUG,
  title: 'Your share check',
  _status: 'published',
  publishedAt: new Date().toISOString(),
  content: root([
    heading('h2', 'What it means for one home'),
    p('Some text above the tabs, so the page has room to scroll.'),
    block('bill-1', {
      blockType: 'factTabs',
      tabs: [
        {
          ...FACT_TABS_FIXTURE.tabs[0],
          value: '+{yearly} a year',
          heading: 'What does this mean for your property taxes?',
          panel: [
            {
              blockType: 'billShare',
              intro: 'Based on the City’s average home. Change the value to see yours.',
              years: [
                {
                  year: 2026,
                  label: '2026 rates',
                  averageHome: 481300,
                  schools: 8.6814,
                  county: 2.3564,
                  matc: 0.6153,
                  city: 7.0139,
                },
                {
                  year: 2027,
                  label: '2027 rates',
                  note: 'proposed',
                  averageHome: 500300,
                  city: 6.93,
                },
              ],
            },
            chart('operating'),
            chart('dayToDay'),
          ],
        },
        ...FACT_TABS_FIXTURE.tabs.slice(1),
      ],
    }),
    heading('h2', 'More below'),
    p('Some text under the tabs.'),
  ]),
})
