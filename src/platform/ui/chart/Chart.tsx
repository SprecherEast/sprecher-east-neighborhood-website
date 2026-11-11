import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { toChartSummary, toChartTable, toScaleNote } from '@/platform/lib/chart/table'
import { CHART_SMALL_WIDTH } from '@/platform/ui/layoutSizes'
import { Disclosure } from '@/platform/ui/Disclosure'
import { Legend } from '@/platform/ui/Legend'
import { Text } from '@/platform/ui/Text'

import type { ChartAdapter } from './chartAdapter'
import { ChartCaption, hasCaption, type ChartCaptionProps } from './ChartCaption'
import { ChartDataTable } from './ChartDataTable'
import { toChartLegends } from './chartLegends'
import { CHART_DRAWING_ATTRIBUTE } from './chartDrawing'
import { CHART_PALETTE } from './chartPalette'
import { adapterFor } from './chartRegistry'
import { ChartZoom } from './ChartZoom.client'

/**
 * The thumbnail's layout (#681), by the width of the chart's own container, so it is the same in a
 * Fact tab panel and a post body: from 42rem the drawing sits left at the small width with the
 * title, key and caption beside it; narrower, and in the 40rem dialog, everything stacks.
 */
const THUMBNAIL_FIGURE =
  'grid @2xl/chart:grid-cols-[var(--chart-small-width)_1fr] @2xl/chart:grid-rows-[auto_auto_auto_1fr] @2xl/chart:gap-x-6'

export type ChartProps = {
  spec: ChartSpec
  /** Draws with this adapter instead of the registry's choice: for the gallery and the contract tests */
  adapter?: ChartAdapter
  /** Shows a thumbnail a reader can enlarge (#681). On by default; an editor turns it off for one chart (#686) */
  zoom?: boolean
  /**
   * Where the numbers table goes: under a closed "Show the numbers" box (default), or kept for screen
   * readers only, for a chart whose drawing already prints every value (#980)
   */
  numbers?: 'disclosure' | 'screen-reader'
  /**
   * Whether the title and takeaway show: kept for screen readers only when the heading above the
   * chart already says it, so two headings never sit one after another (#980)
   */
  heading?: 'visible' | 'screen-reader'
  className?: string
}

/** What goes under the drawing: what a unit means, when the figures are from, where they came from, how sure we are */
function captionOf(spec: ChartSpec): ChartCaptionProps {
  return {
    notes: [toScaleNote(spec), spec.kind === 'units' ? spec.unitNote : null].filter(
      (note): note is string => Boolean(note),
    ),
    finePrint: spec.finePrint,
    asOf: spec.asOf,
    sources: spec.sources,
    certainty: spec.certainty,
  }
}

/**
 * The one chart (#639): the only component the app uses to draw one. A figure with its title and
 * takeaway, the drawing from whichever adapter the registry picks for the kind, the colour key,
 * a caption (what a unit means, when, where from, how sure) and, under it, the same numbers as a
 * table that starts closed. The spec is checked first, so a chart that does not add up is an
 * error and never a wrong picture.
 */
export function Chart({
  spec: input,
  adapter: chosen,
  zoom = true,
  numbers = 'disclosure',
  heading = 'visible',
  className,
}: ChartProps) {
  const spec = parseChartSpec(input)
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-description`
  const adapter = chosen ?? adapterFor(spec.kind)
  const legends = adapter.usesColour ? toChartLegends(spec, CHART_PALETTE) : []

  // A drawing is a thumbnail with its text beside it; `zoom` adds the Enlarge button and its dialog
  const thumbnail = adapter.enlargeable
  const enlargeable = zoom && thumbnail
  const body = (
    <div
      data-chart-palette={spec.palette}
      className={cn('not-prose space-y-3', thumbnail && !zoom && '@container/chart', className)}
    >
      <figure className={cn(!thumbnail && 'space-y-4', thumbnail && THUMBNAIL_FIGURE)}>
        <div
          className={cn(
            'space-y-1',
            heading === 'screen-reader' && 'sr-only',
            thumbnail && '@2xl/chart:col-start-2 @2xl/chart:row-start-1',
            enlargeable && 'scripted:@2xl/chart:pr-36',
          )}
        >
          <Text variant="subsection" as="p" id={titleId}>
            {spec.title}
          </Text>
          <Text variant="small" as="p">
            {spec.summary}
          </Text>
        </div>
        <p id={descId} className="sr-only">
          {toChartSummary(spec)}
        </p>
        <div
          {...{ [CHART_DRAWING_ATTRIBUTE]: '' }}
          className={cn(
            thumbnail && [
              'mt-4 w-full @2xl/chart:col-start-1 @2xl/chart:row-span-4 @2xl/chart:row-start-1 @2xl/chart:mt-0',
              CHART_SMALL_WIDTH,
            ],
          )}
        >
          {adapter.render(spec, { titleId, descId, palette: CHART_PALETTE })}
        </div>
        {legends.length > 0 && (
          <div className={cn(thumbnail && 'mt-4 @2xl/chart:col-start-2 @2xl/chart:row-start-2')}>
            {legends.map((legend) => (
              <Legend
                key={legend.label}
                marker="swatch"
                attach="none"
                columns="one"
                label={legend.label}
                items={legend.items}
              />
            ))}
          </div>
        )}
        {hasCaption(captionOf(spec)) && (
          <ChartCaption
            {...captionOf(spec)}
            className={cn(thumbnail && 'mt-4 @2xl/chart:col-start-2 @2xl/chart:row-start-3')}
          />
        )}
      </figure>
      {numbers === 'screen-reader' ? (
        <div className="sr-only">
          <ChartDataTable table={toChartTable(spec)} focusable={false} />
        </div>
      ) : (
        <Disclosure variant="card" summary="Show the numbers">
          <ChartDataTable table={toChartTable(spec)} />
        </Disclosure>
      )}
    </div>
  )
  return enlargeable ? <ChartZoom title={spec.title}>{body}</ChartZoom> : body
}
