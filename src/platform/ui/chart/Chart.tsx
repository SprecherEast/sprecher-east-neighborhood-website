import React, { useId } from 'react'

import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { toChartSummary, toChartTable, toScaleNote } from '@/platform/lib/chart/table'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Caption } from '@/platform/ui/Caption'
import { Disclosure } from '@/platform/ui/Disclosure'
import { Legend } from '@/platform/ui/Legend'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import type { ChartAdapter } from './chartAdapter'
import { ChartDataTable } from './ChartDataTable'
import { ChartLayout, type ChartParts } from './ChartLayout'
import { toChartLegends } from './chartLegends'
import { CHART_PALETTE } from './chartPalette'
import { adapterFor } from './chartRegistry'
import { ChartZoom } from './ChartZoom.client'

export type ChartProps = {
  spec: ChartSpec
  /** Draws with this adapter instead of the registry's choice: for the gallery and the contract tests */
  adapter?: ChartAdapter
  className?: string
}

/**
 * The one chart (#639): the only component the app uses to draw one. A figure with its title and
 * takeaway, the drawing from whichever adapter the registry picks for the kind, the colour key,
 * a caption (what a unit means, when, where from, how sure) and, under it, the same numbers as a
 * table that starts closed. The spec is checked first, so a chart that does not add up is an
 * error and never a wrong picture. A picture is a thumbnail a reader can enlarge (`ChartZoom`,
 * #681); the layout and sizes are `ChartLayout`'s.
 */
export function Chart({ spec: input, adapter: chosen, className }: ChartProps) {
  const spec = parseChartSpec(input)
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-description`
  const adapter = chosen ?? adapterFor(spec.kind)
  const legends = adapter.usesColour ? toChartLegends(spec, CHART_PALETTE) : []

  const parts: ChartParts = {
    head: (
      <>
        <div className="space-y-1">
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
      </>
    ),
    drawing: adapter.render(spec, { titleId, descId, palette: CHART_PALETTE }),
    details: (
      <>
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
        <ChartCaption spec={spec} />
      </>
    ),
    numbers: (
      <Disclosure variant="card" summary="Show the numbers">
        <ChartDataTable table={toChartTable(spec)} />
      </Disclosure>
    ),
  }

  // A picture is a thumbnail a reader can enlarge; words already read at any width
  if (!adapter.enlargeable) return <ChartLayout variant="plain" className={className} {...parts} />
  return <ChartZoom title={spec.title} className={className} {...parts} />
}

/** What a unit means, when the figures are from, where they came from and how sure we are */
function ChartCaption({ spec }: { spec: ChartSpec }) {
  const notes = [toScaleNote(spec), spec.kind === 'units' ? spec.unitNote : null].filter(Boolean)
  return (
    <Caption as="figcaption" finePrint={spec.finePrint}>
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
