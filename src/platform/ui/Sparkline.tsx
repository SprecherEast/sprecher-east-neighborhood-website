import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * How much happened over time, as a thin line on a scale from 0 to `max`. Callers that show several
 * together pass the same `max`, so the same height always means the same number. It is never the only
 * signal: the caller writes the numbers beside it, and `label` gives every value to screen readers.
 * Drawn from theme tokens (`stroke-primary`, `stroke-border`); a series of zeros is the flat baseline.
 */
const WIDTH = 100
const HEIGHT = 24
const PAD = 2

function pointFor(value: number, index: number, count: number, max: number): [number, number] {
  const share = max > 0 ? Math.min(Math.max(value, 0), max) / max : 0
  const x = count > 1 ? PAD + (index * (WIDTH - 2 * PAD)) / (count - 1) : WIDTH / 2
  const y = HEIGHT - PAD - share * (HEIGHT - 2 * PAD)
  return [x, y]
}

export type SparklineProps = {
  values: number[]
  /** The top of the scale; share it between pictures that are read side by side */
  max: number
  /** What it shows, with every value, for screen readers: "Finished per week: 0, 2, 5" */
  label: string
  className?: string
}

export function Sparkline({ values, max, label, className }: SparklineProps) {
  const points = values.map((value, index) => pointFor(value, index, values.length, max))
  const baseline = HEIGHT - PAD

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('block h-6 w-full', className)}
    >
      <line
        x1={PAD}
        y1={baseline}
        x2={WIDTH - PAD}
        y2={baseline}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        className="stroke-border"
      />
      {points.length > 1 ? (
        <polyline
          points={points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary"
        />
      ) : null}
      {points.length === 1 ? (
        <circle cx={points[0][0]} cy={points[0][1]} r={2} className="fill-primary" />
      ) : null}
    </svg>
  )
}
