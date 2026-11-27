import { part, PROPOSAL } from './fixtureParts'
import type { ChartSpec } from './spec'

export const COMPACT_FIXTURES = {
  /*
   * The adopted 2026 and 2027 budgets as the post shows them in its Day-to-day and Big-project tabs
   * (adopted totals; the areas are still the Mayor's proposal), in the two compact looks (#1503).
   * `Change` is the stacked chart with `look: 'change'`; `Rows` is a bar chart with compact density.
   */
  operatingChange: {
    kind: 'stacked',
    orientation: 'horizontal',
    look: 'change',
    title: '2026 and 2027 adopted',
    summary: 'The Council adopted $25.0 million more than in 2026.',
    unit: 'usd',
    x: ['2026 adopted', '2027 adopted'],
    scaleMax: 500_000_000,
    series: [
      { key: 'same', label: 'Same as 2026', values: [452_723_152, 452_723_152] },
      {
        key: 'increase',
        label: 'Increase',
        values: [0, 25_026_546],
        pattern: 'hatch',
        increase: true,
      },
    ],
  },
  capitalChange: {
    kind: 'stacked',
    orientation: 'horizontal',
    look: 'change',
    title: '2026 and 2027 adopted',
    summary: 'Borrowing pays for about $62 of every $100. The total is $9.7M more than in 2026.',
    unit: 'usd',
    x: ['2026 adopted', '2027 adopted'],
    scaleMax: 300_000_000,
    series: [
      { key: 'borrowed', label: 'Borrowed', values: [171_688_393, 184_782_375] },
      {
        key: 'other',
        label: 'Other sources',
        values: [114_504_815, 111_150_208],
        pattern: 'hatch',
      },
    ],
  },
  /** The Mayor's 2027 amounts by area next to 2026 adopted; "Everything else" and "Administration" are one row, as the 2026 figures are published together */
  operatingRows: {
    kind: 'bar',
    orientation: 'horizontal',
    density: 'compact',
    title: 'Where the day-to-day money goes',
    summary: 'Public safety is the biggest area, and paying back loans grows the most.',
    unit: 'usd',
    asOf: PROPOSAL,
    previousLabel: '2026 adopted',
    data: [
      { ...part('safety', 'Public safety', 194_768_276), previous: 186_307_712 },
      { ...part('debt', 'Debt service', 80_479_929), previous: 71_703_700 },
      {
        ...part('everything-else', 'Everything else and administration', 107_784_343),
        previous: 103_663_876,
      },
      { ...part('works', 'Public works', 56_659_014), previous: 54_514_998 },
      { ...part('transport', 'Transportation', 37_858_292), previous: 36_532_866 },
    ],
  },
  capitalRows: {
    kind: 'bar',
    orientation: 'horizontal',
    density: 'compact',
    title: 'How the big projects are paid for',
    summary: 'Borrowing pays for most of it, and grew by $13.1M.',
    unit: 'usd',
    previousLabel: '2026 adopted',
    data: [
      { ...part('borrowed', 'Borrowed', 184_782_375), previous: 171_688_393 },
      { ...part('other', 'Other sources', 111_150_208), previous: 114_504_815 },
    ],
  },
} satisfies Record<string, ChartSpec>
