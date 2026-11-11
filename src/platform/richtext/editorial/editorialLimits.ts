/**
 * Size limits of the editorial blocks, defined once (guard rail 1): the block's Payload fields,
 * the Markdown tag's schema and the tests all read these, so what the editor saves is what an
 * agent's tag may hold. A chart's limits are `CHART_LIMITS` in `@/platform/lib/chart/spec`.
 */

/** The optional "read more" link an item carries (`editorialLinkFields`) */
export const LINK_LABEL_MAX = 60

/** One key fact (`keyFactFields`): the same on the key facts block and on each fact tab */
export const KEY_FACT_LIMITS = {
  value: 24,
  label: 60,
  detail: 90,
} as const

/** The key facts block */
export const KEY_FACTS_LIMITS = { minFacts: 2, maxFacts: 6 } as const

/** The timeline block */
export const TIMELINE_LIMITS = {
  minEntries: 2,
  maxEntries: 12,
  date: 40,
  title: 100,
  description: 300,
} as const

/** The fact tabs block: each tab is a key fact that opens a panel of charts and timelines */
export const FACT_TABS_LIMITS = {
  minTabs: 2,
  maxTabs: 4,
  heading: 40,
  definition: 240,
  minPanelBlocks: 1,
  maxPanelBlocks: 3,
} as const

/** The bill split block (#1018): one set of rates per tax year, the latest last */
export const BILL_SHARE_LIMITS = {
  minYears: 1,
  maxYears: 2,
  intro: 160,
  label: 40,
} as const
