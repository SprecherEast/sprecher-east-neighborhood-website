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

/** Dollars from the budget's figures in millions, to the dollar */
const millions = (m: number) => Math.round(m * 1_000_000)
const piece = (key: string, label: string, m: number, shown?: true) => ({
  key,
  label,
  value: millions(m),
  ...(shown && { shown }),
})
const area = (key: string, label: string, m: number, pieces?: ReturnType<typeof piece>[]) => ({
  key,
  label,
  value: millions(m),
  ...(pieces && { pieces }),
})

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
    unitNote: 'Squares are rounded to whole squares.',
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
    unitNote: 'Squares are rounded to whole squares.',
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
  /** Stacked bars on the bars' scale: 2027 is 2026's amount plus the proposed increase, hatched */
  operating: {
    kind: 'stacked',
    orientation: 'horizontal',
    title: 'The day-to-day budget, with the proposed increase',
    summary: 'The Mayor proposes $24.8 million more than the 2026 budget.',
    unit: 'usd',
    asOf: PROPOSAL,
    certainty: 'confirmed',
    sources: [EXEC_OPERATING],
    x: ['2026 adopted', '2027 proposed'],
    scaleMax: 500_000_000,
    series: [
      { key: 'same', label: 'Same as 2026', values: [452_723_152, 452_723_152] },
      {
        key: 'increase',
        label: 'Proposed increase',
        values: [0, 24_826_701],
        pattern: 'hatch',
        increase: true,
      },
    ],
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
  /** Where the day-to-day (General and Library Funds) money goes: $5M a square, smaller pieces folded away */
  dayToDay: {
    kind: 'breakdown',
    title: 'Where the day-to-day dollars go',
    summary: 'Public safety and health take the biggest share of the $477.5M day-to-day budget.',
    unit: 'usd',
    squareValue: millions(5),
    asOf: PROPOSAL,
    sources: [EXEC_OPERATING],
    areas: [
      area('debt', 'Debt service', 80.479929),
      area('safety', 'Public safety & health', 194.768276, [
        piece('police', 'Police', 102.492663, true),
        piece('fire', 'Fire / EMS', 81.114847, true),
        piece('health', 'Public Health', 10.728438),
      ]),
      area('works', 'Public works', 56.659014, [
        piece('streets', 'Streets', 30.473166),
        piece('parks', 'Parks', 18.91529),
      ]),
      area('transport', 'Transportation', 37.858292, [
        piece('transit', 'Metro Transit', 25.506519),
      ]),
      area('admin', 'Administration', 36.85902),
      area('else', 'Everything else', 70.925323, [
        piece('planning', 'Planning & development', 31.479633),
        piece('library', 'Library', 24.927453),
        piece('misc', 'Miscellaneous', 10.969427),
        piece('general', 'General government', 3.54881),
      ]),
    ],
  },
  /** Where the big-project (capital) money goes: all funding sources */
  bigProject: {
    kind: 'breakdown',
    title: 'Where the big-project dollars go',
    summary: 'Housing and streets take the biggest shares of the $272.2M big-project budget.',
    unit: 'usd',
    squareValue: millions(5),
    asOf: PROPOSAL,
    sources: [EXEC_CAPITAL],
    areas: [
      area('housing', 'Housing & economic dev.', 78.845),
      area('streets', 'Streets, bike & traffic', 75.523),
      area('water', 'Water, sewer & storm', 35.184),
      area('fleet', 'Fleet vehicles', 18.793),
      area('parks', 'Parks', 17.9),
      area('else', 'Everything else', 45.9625, [
        piece('transit', 'Transit & parking', 16.901),
        piece('buildings', 'City buildings & other', 13.3915),
        piece('admin', 'Administration & IT', 8.755),
        piece('public-safety', 'Police & Fire', 4.356),
        piece('library', 'Library', 2.559),
      ]),
    ],
  },
} satisfies Record<string, ChartSpec>
