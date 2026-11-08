import React from 'react'

import { toBreakdown } from '@/platform/lib/chart/breakdown'

import type { ChartAdapter } from '../../chartAdapter'

import { BreakdownChart } from './BreakdownChart'

/**
 * The breakdown adapter (#866): a grid of squares worth a fixed amount, ranked bars and a list of
 * smaller pieces, as plain HTML with the bars as small SVG rects whose length is an attribute (no
 * `style`). It draws at the full width of the page, so there is no thumbnail and no enlarging, and it
 * draws its own key in dollars, so `Chart` adds none.
 */
export const breakdownAdapter: ChartAdapter = {
  name: 'breakdown',
  output: 'html',
  kinds: new Set<'breakdown'>(['breakdown']),
  usesColour: false,
  enlargeable: false,
  render(spec, { titleId, descId }) {
    if (spec.kind !== 'breakdown') {
      throw new Error(`The breakdown adapter does not draw ${spec.kind} charts`)
    }
    return (
      <BreakdownChart
        model={toBreakdown(spec)}
        squareValue={spec.squareValue}
        titleId={titleId}
        descId={descId}
      />
    )
  },
}
