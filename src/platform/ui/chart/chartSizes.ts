/*
 * How big a bar and its text are in every chart and data display that draws labelled bars (#1503):
 * the breakdown chart, the bill's rows and the bar and stacked chart follow the same numbers,
 * measured from the site's own text scale and the breakdown's bars, so no display sets its own.
 * `chartSizes.test.ts` pins each to the class it comes from.
 */

/** A bar's thickness: the breakdown chart's main bars (`h-3.5`); a bill's rows and nested bars are thinner */
export const CHART_BAR_THICKNESS_CLASS = 'h-3.5'
export const CHART_BAR_THICKNESS_PX = 14

/** Text in a drawing, in px at 1:1: a name and its total as body text (`text-base`), values and notes as the kit's small text (`text-sm`) */
export const CHART_TEXT_PX = { name: 16, detail: 14 } as const
