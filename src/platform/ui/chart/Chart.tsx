import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { toChartSummary, toChartTable, toScaleNote } from '@/platform/lib/chart/table'
import { CHART_SMALL_WIDTH } from '@/platform/ui/layoutSizes'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Caption } from '@/platform/ui/Caption'
import { Disclosure } from '@/platform/ui/Disclosure'
import { Legend } from '@/platform/ui/Legend'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import type { ChartAdapter } from './chartAdapter'
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
  /** Shows a thumbnail a reader can enlarge (#681). On by default; off only in the gallery and tests */
  zoom?: boolean
  className?: string
}

/**
 * The one chart (#639): the only component the app uses to draw one. A figure with its title and
 * takeaway, the drawing from whichever adapter the registry picks for the kind, the colour key,
 * a caption (what a unit means, when, where from, how sure) and, under it, the same numbers as a
 * table that starts closed. The spec is checked first, so a chart that does not add up is an
 * error and never a wrong picture.
 */
export function Chart({ spec: input, adapter: chosen, zoom = true, className }: ChartProps) {
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
    <div className={cn('not-prose space-y-3', thumbnail && !zoom && '@container/chart', className)}>
      <figure className={cn(!thumbnail && 'space-y-4', thumbnail && THUMBNAIL_FIGURE)}>
        <div
          className={cn(
            'space-y-1',
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
                label={legend.label}
                items={legend.items}
              />
            ))}
          </div>
        )}
        <ChartCaption
          spec={spec}
          className={cn(thumbnail && 'mt-4 @2xl/chart:col-start-2 @2xl/chart:row-start-3')}
        />
      </figure>
      <Disclosure variant="card" summary="Show the numbers">
        <ChartDataTable table={toChartTable(spec)} />
      </Disclosure>
    </div>
  )
  return enlargeable ? <ChartZoom title={spec.title}>{body}</ChartZoom> : body
}

/** What a unit means, when the figures are from, where they came from and how sure we are */
function ChartCaption({ spec, className }: { spec: ChartSpec; className?: string }) {
  const notes = [toScaleNote(spec), spec.kind === 'units' ? spec.unitNote : null].filter(Boolean)
  return (
    <Caption as="figcaption" finePrint={spec.finePrint} className={className}>
      {notes.length > 0 && <span className="block">{notes.join(' ')}</span>}
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {spec.asOf && <span>{spec.asOf}</span>}
        {spec.sources?.map((source) => (
          <Link
            key={source.href}
            href={source.href}
            external={source.href.startsWith('http')}
            variant="caption"
          >
            {source.label}
          </Link>
        ))}
        {spec.certainty && <CertaintyBadge certainty={spec.certainty} />}
      </span>
    </Caption>
  )
}
