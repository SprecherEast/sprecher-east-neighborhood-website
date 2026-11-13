import React, { useId } from 'react'

import { toBreakdown, valuesAt } from '@/platform/lib/chart/breakdown'
import { scaleBreakdown } from '@/platform/lib/chart/scale'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import { Text } from '@/platform/ui/Text'
import { useReplayProgress } from '@/platform/ui/useReplayProgress.client'

import { BreakdownChart } from './adapters/breakdown/BreakdownChart'
import { ChartCaption, hasCaption } from './ChartCaption'

/**
 * A breakdown chart drawn in the browser with every amount multiplied by `factor` (#1020): the City's
 * tax on the home a reader typed, split the way the budget is. It is the same figure as `Chart`
 * draws for a breakdown (title, takeaway, the drawing, the caption) from the same drawing code, but
 * it takes a spec that was already checked on the server and never parses it, so no spec rules (zod)
 * and no chart library reach the browser; `ScaledBreakdown.test.tsx` guards that. Every figure is
 * text in the drawing, so it has no separate numbers table. Each time `fillKey` changes (a row that
 * holds it opening), the bars grow and the amounts count up from nothing, while the percents stay
 * put; `compact` draws thinner bars, for a breakdown inside a bill (#1163).
 */
export function ScaledBreakdown({
  spec,
  factor,
  title = 'visible',
  fillKey = 0,
  compact = false,
}: {
  spec: Extract<ChartSpec, { kind: 'breakdown' }>
  factor: number
  /**
   * Whether the title shows: kept for screen readers only when the heading above already says it,
   * so two headings never sit one after another (as `Chart` does with `heading`). The takeaway
   * always shows (#1144)
   */
  title?: 'visible' | 'screen-reader'
  /** Changes each time the bars should fill again; 0 keeps the reveal on scroll */
  fillKey?: number
  compact?: boolean
}) {
  const id = useId()
  const progress = useReplayProgress(fillKey)
  const scaled = scaleBreakdown(spec, factor)
  const caption = {
    notes: [],
    finePrint: spec.finePrint,
    asOf: spec.asOf,
    sources: spec.sources,
    certainty: spec.certainty,
  }
  return (
    <div data-chart-palette={spec.palette} className="not-prose space-y-3">
      <figure className="space-y-4">
        <div className="space-y-1">
          <Text
            variant="subsection"
            as="p"
            id={`${id}-title`}
            className={title === 'screen-reader' ? 'sr-only' : undefined}
          >
            {spec.title}
          </Text>
          <Text variant="small" as="p">
            {spec.summary}
          </Text>
        </div>
        <BreakdownChart
          // Drawn anew each opening, so the bars' fill starts over
          key={fillKey}
          model={valuesAt(toBreakdown(scaled), progress)}
          compact={compact}
          fill={fillKey > 0}
          squareValue={scaled.squareValue ?? 0}
          titleId={`${id}-title`}
          descId={`${id}-title`}
        />
        {hasCaption(caption) && <ChartCaption {...caption} />}
      </figure>
    </div>
  )
}
