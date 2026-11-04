import type { ChartSpec } from './spec'

/*
 * Sample charts for tests and the gallery, from the City of Madison's published 2026 adopted and
 * 2027 executive (the Mayor's proposed) budgets, General and Library Funds. The Council has not
 * voted on 2027 yet, so every 2027 figure says "proposed".
 */

const EXEC_OPERATING = {
  label: 'City of Madison, 2027 Executive Operating Budget, page 15',
  href: 'https://cg-prod-v2.s3.us-east-2.amazonaws.com/cleardocs/pdf/ClearDoc_28992_1791304561966.pdf',
}
const EXEC_CAPITAL = {
  label: 'City of Madison, 2027 Executive Capital Budget, page 34',
  href: 'https://www.cityofmadison.com/finance/documents/capital/executive/2027ExecutiveCapitalBudgetFinal.pdf',
}
const PROPOSAL = "Mayor's proposal, October 2026"

const part = (key: string, label: string, value: number) => ({ key, label, value })

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const FIXTURES = {
  /** Two grids on one screen: what the money pays for, 2026 adopted next to 2027 proposed */
  paysFor: {
    kind: 'units',
    mode: 'perHundred',
    title: 'What the money pays for, proposed',
    summary:
      'Police, fire and health is the biggest share of every $100 in both years, and paying back loans is the part that grows most.',
    unit: 'usd',
    asOf: PROPOSAL,
    certainty: 'confirmed',
    sources: [EXEC_OPERATING],
    unitNote: 'Squares are rounded to whole squares; exact amounts are under Show the numbers.',
    finePrint:
      'The 2027 figures are the Mayor’s proposal, not the budget the Council adopts. General and Library funds only.',
    groups: [
      {
        key: 'y2026',
        label: '2026 adopted',
        total: 452_723_152,
        data: [
          part('safety', 'Police, fire and health', 186_307_712),
          part('debt', 'Paying back loans', 71_703_700),
          part('works', 'Public works', 54_514_998),
          part('planning', 'Planning and public buildings', 54_302_011),
          part('running', 'Running the City', 49_361_865),
          part('transport', 'Getting around', 36_532_866),
        ],
      },
      {
        key: 'y2027',
        label: '2027 proposed',
        total: 477_549_854,
        data: [
          part('safety', 'Police, fire and health', 194_768_276),
          part('debt', 'Paying back loans', 80_479_929),
          part('works', 'Public works', 56_659_014),
          part('planning', 'Planning and public buildings', 56_407_086),
          part('running', 'Running the City', 51_377_257),
          part('transport', 'Getting around', 37_858_292),
        ],
      },
    ],
  },
  /** One grid: where the 2027 proposal's money comes from */
  comesIn: {
    kind: 'units',
    mode: 'perHundred',
    title: 'Where the money comes in, proposed',
    summary: 'Property tax pays for about 71 of every $100 in the 2027 proposal.',
    unit: 'usd',
    asOf: PROPOSAL,
    certainty: 'confirmed',
    sources: [EXEC_OPERATING],
    unitNote: 'Squares are rounded to whole squares; exact amounts are under Show the numbers.',
    groups: [
      {
        key: 'y2027',
        label: '2027 proposed',
        total: 477_549_854,
        data: [
          part('levy', 'Property tax (the levy)', 337_902_281),
          part('fees', 'Fees and charges (local revenues)', 79_770_375),
          part('aid', 'State and federal aid', 53_237_694),
          part('savings', 'Savings (fund balance)', 6_639_504),
        ],
      },
    ],
  },
  /** Twelve tiles: the extra City property tax on an average home, a month at a time */
  months: {
    kind: 'units',
    mode: 'each',
    title: 'What the proposal adds each month',
    summary: 'On an average home the City’s share of the tax bill goes up about $7.50 a month.',
    unit: 'usd',
    asOf: PROPOSAL,
    certainty: 'confirmed',
    sources: [
      { ...EXEC_OPERATING, label: 'City of Madison, 2027 Executive Operating Budget, page 27' },
    ],
    unitNote:
      'Each tile is one month of the extra $90.04 a year (about $7.50). This is the City’s share only, not schools, the County or MATC.',
    groups: [
      {
        key: 'month',
        label: 'Extra per month',
        total: 90.04,
        data: MONTHS.map((label) => part(label.toLowerCase(), label, 7.5)),
      },
    ],
  },
  /** Stacked bars: how much of the big-project money is borrowed */
  borrowed: {
    kind: 'stacked',
    orientation: 'horizontal',
    title: 'How the big projects are paid for, proposed',
    summary:
      'Borrowing pays for about two thirds of the 2027 big-project budget, $14.0M less in total than 2026.',
    unit: 'usd',
    asOf: PROPOSAL,
    certainty: 'confirmed',
    sources: [EXEC_CAPITAL],
    x: ['2026 adopted', '2027 proposed'],
    scaleMax: 300_000_000,
    series: [
      { key: 'borrowed', label: 'Borrowed', values: [171_688_393, 179_789_647] },
      { key: 'other', label: 'Other sources', values: [114_504_815, 92_417_816], pattern: 'hatch' },
    ],
    rowNotes: ['$60 of every $100 is borrowed', '$66 of every $100 is borrowed'],
    finePrint: 'The $60 and $66 are our calculation from the City’s figures.',
  },
  /** Two bars: the day-to-day budget, 2027 hatched because it is only proposed */
  bars: {
    kind: 'bar',
    orientation: 'horizontal',
    title: 'The day-to-day budget, proposed',
    summary: 'The Mayor proposes $24.8 million more than the 2026 budget.',
    unit: 'usd',
    asOf: PROPOSAL,
    certainty: 'confirmed',
    sources: [EXEC_OPERATING],
    scaleMax: 500_000_000,
    data: [
      part('y2026', '2026 adopted', 452_723_152),
      { ...part('y2027', '2027 proposed', 477_549_853), pattern: 'hatch' },
    ],
  },
} satisfies Record<string, ChartSpec>
