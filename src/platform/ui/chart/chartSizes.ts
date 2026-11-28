/*
 * How big a bar and its text are in every chart and data display that draws labelled bars (#1503):
 * the bar and stacked chart takes the breakdown chart's bar thickness and row text size,
 * measured from the site's own text scale, so no display sets its own.
 * `chartSizes.test.ts` pins each to the class it comes from.
 */

/** A bar's thickness: the breakdown chart's main bars (`h-3.5`); a bill's rows and nested bars are thinner */
export const CHART_BAR_THICKNESS_CLASS = 'h-3.5'
export const CHART_BAR_THICKNESS_PX = 14

/** Text in a drawing, in px at 1:1: names, totals, values and notes are all the kit's small text (`text-sm`), as the breakdown chart's rows are; a name is semibold */
export const CHART_TEXT_PX = 14
