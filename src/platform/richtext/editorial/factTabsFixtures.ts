import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { fromChartSpec } from './chart'
import type { StoredFactTabs } from './factTabs'

/*
 * Four fact tabs about the Mayor's 2027 proposal, as the editor stores them (#664), for the
 * gallery and the tests. The figures are the City's published ones (`FIXTURES`); the Council has
 * not voted, so each says proposed. The dates are placeholders to read the layout with.
 */

const chart = (name: keyof typeof FIXTURES) => ({
  blockType: 'chart' as const,
  ...fromChartSpec(parseChartSpec(FIXTURES[name])),
})
const [OPERATING_SOURCE] = FIXTURES.bars.sources

export const FACT_TABS_FIXTURE = {
  tabs: [
    {
      value: '$477.5M',
      label: 'Day-to-day money, proposed',
      icon: 'money',
      certainty: 'confirmed',
      linkLabel: OPERATING_SOURCE.label,
      linkUrl: OPERATING_SOURCE.href,
      heading: 'Day-to-day money, proposed',
      definition:
        'What the City would spend in 2027 on services residents use every day, such as police, fire, health, streets and parks. That is $24.8 million more than in 2026.',
      panel: [chart('bars'), chart('paysFor')],
    },
    {
      value: '$272.2M',
      label: 'Big-project money, proposed',
      icon: 'construction',
      certainty: 'confirmed',
      heading: 'Big-project money, proposed',
      definition:
        'What the City would spend in 2027 to build and repair things that last, such as streets, buildings and parks. Most of it is borrowed and paid back over many years.',
      panel: [chart('borrowed')],
    },
    {
      value: '+$90.04',
      label: 'More a year, City share, average home',
      icon: 'taxes',
      certainty: 'confirmed',
      heading: 'One average home',
      definition:
        'The extra City property tax on an average Madison home in a year. It is the City’s share only, not schools, the County or MATC.',
      panel: [chart('months')],
    },
    {
      value: 'Nov 10',
      label: 'Council votes (Nov 11-12 if needed)',
      icon: 'date',
      certainty: 'estimate',
      heading: 'When the Council votes',
      definition:
        'The Council can change the proposal before it votes. The dates here are placeholders until the City posts the final schedule.',
      panel: [
        {
          blockType: 'timeline' as const,
          entries: [
            { date: 'Oct 2026', status: 'done', title: 'The Mayor proposes the 2027 budget' },
            { date: 'Nov 10', status: 'next', title: 'The Council votes on the budget' },
            {
              date: 'Nov 11-12',
              status: 'conditional',
              title: 'The vote continues if it is not finished',
            },
            { date: 'Jan 2027', status: 'later', title: 'The new budget starts' },
          ],
        },
      ],
    },
  ],
} as StoredFactTabs
