import { Group } from '@visx/group'
import { PatternLines } from '@visx/pattern'
import { Line } from '@visx/shape'
import React from 'react'

import { formatValue } from '@/platform/lib/chart/format'

import type { ChartRenderContext } from '../../chartAdapter'

import {
  BAR_HEIGHT,
  GRID_OVERHANG,
  FONT_SIZE,
  HEAD_BASELINE,
  LINE_HEIGHT,
  PAD_X,
  SMALL_FONT_SIZE,
  VIEW_WIDTH,
  layoutBars,
  type PlacedRow,
} from './barLayout'
import type { BarModel } from './barModel'
import { BarSegment } from './BarSegments'

type Props = { model: BarModel } & ChartRenderContext

/** An id that is safe inside `url(#…)`: the chart's description id, which React makes unique */
const hatchId = (descId: string) => `${descId.replace(/[^\w-]/g, '')}-hatch`

type RowProps = { row: PlacedRow; gridX: number[]; palette: Props['palette']; patternId: string }

function RowView({ row, gridX, palette, patternId }: RowProps) {
  return (
    <Group top={row.y}>
      {gridX.map((x) => (
        <Line
          key={x}
          from={{ x, y: row.barY - GRID_OVERHANG }}
          to={{ x, y: row.barY + BAR_HEIGHT + GRID_OVERHANG }}
          className="stroke-border"
          strokeWidth={1}
        />
      ))}
      {row.headLines.map((line, i) => (
        <text
          key={i}
          y={HEAD_BASELINE + i * LINE_HEIGHT}
          fontSize={FONT_SIZE}
          className="fill-foreground"
        >
          <tspan className="font-semibold">{line.text}</tspan>
          {line.total && line.text && ' '}
          {line.total && <tspan dx={line.text ? 4 : 0}>{line.total}</tspan>}
        </text>
      ))}
      <g className="chart-reveal-x">
        {row.segments.map((segment, i) => (
          <BarSegment
            key={`${segment.key}-${i}`}
            segment={segment}
            y={row.barY}
            palette={palette}
            patternId={patternId}
          />
        ))}
      </g>
      {row.labels.map((label) => (
        <text
          key={label.text}
          x={label.x}
          y={row.labelY + label.line * LINE_HEIGHT}
          textAnchor={label.anchor}
          fontSize={SMALL_FONT_SIZE}
          className="fill-foreground"
        >
          {label.text}
        </text>
      ))}
      {row.noteLines.map((line, i) => (
        <text
          key={i}
          y={row.noteY + i * LINE_HEIGHT}
          fontSize={SMALL_FONT_SIZE}
          className="fill-muted-foreground"
        >
          {line}
        </text>
      ))}
    </Group>
  )
}

/**
 * Horizontal bars, or stacked bars, as one `<svg role="img">` (#663). Every row shares one scale
 * from $0 to `scaleMax`, with a few quiet tick labels. Names and values are real text beside the
 * marks, never on them; the svg scales with its container and holds no inline style.
 */
export function BarChartSvg({ model, titleId, descId, palette }: Props) {
  const layout = layoutBars(model)
  const gridX = layout.ticks.map(layout.scale)
  const patternId = hatchId(descId)
  const hatched = model.rows.some((row) => row.segments.some((s) => s.hatch))
  return (
    <svg
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      viewBox={`0 0 ${VIEW_WIDTH} ${layout.height}`}
      className="block h-auto w-full print-exact"
    >
      {hatched && (
        <PatternLines
          id={patternId}
          width={5}
          height={5}
          orientation={['diagonal']}
          strokeWidth={1.5}
          className="stroke-background"
        />
      )}
      <Group left={PAD_X}>
        {layout.rows.map((row) => (
          <RowView key={row.y} row={row} gridX={gridX} palette={palette} patternId={patternId} />
        ))}
        {layout.ticks.map((tick, i) => (
          <text
            key={tick}
            x={layout.scale(tick)}
            y={layout.axisY + SMALL_FONT_SIZE}
            textAnchor={i === 0 ? 'start' : i === layout.ticks.length - 1 ? 'end' : 'middle'}
            fontSize={SMALL_FONT_SIZE}
            className="fill-muted-foreground"
          >
            {formatValue(tick, model.unit, { compact: true })}
          </text>
        ))}
      </Group>
    </svg>
  )
}
