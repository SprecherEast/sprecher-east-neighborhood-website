import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'
import { smoothLinePath } from '@/platform/lib/smoothPath'

/*
 * How much happened over time, as a smooth curve with a soft fill, a faint baseline, three day
 * labels and a marker on the latest value. Callers that show several together pass the same `max`
 * so one height always means one number. It is never the only signal: the caller writes the
 * figure beside it and `label` lists every value for screen readers. Drawn from theme tokens
 * (`done` or `success`, `border`, `muted-foreground`), on the server with no client code; a series
 * of zeros is the flat baseline, one value is a dot.
 */
const WIDTH = 100
const HEIGHT = 40
const SIDE = 1.5
const TOP = 4
const BASE = 36

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 31" from a `yyyy-mm-dd` day, read as text so no time zone can move it */
export function dayLabel(day: string): string {
  const [, month, date] = day.split('-').map(Number)
  return `${MONTHS[month - 1] ?? ''} ${date}`.trim()
}

const TONES = {
  done: { stroke: 'stroke-done', text: 'text-done' },
  open: { stroke: 'stroke-success', text: 'text-success' },
} as const

export type AreaChartProps = {
  values: number[]
  /** The same length as `values`: `yyyy-mm-dd`, oldest first, the last one today */
  days: string[]
  /** What it shows, with every value, for screen readers: "Finished per day: 0, 2, 5" */
  label: string
  /** Done work or open work, each with a colour of its own */
  tone: keyof typeof TONES
  /** The top of the scale; share it between pictures read side by side. Defaults to the tallest value */
  max?: number
  /** Start the scale at zero (counts per day) or at the lowest value (a running total, to show its shape) */
  fromZero?: boolean
  className?: string
}

export function AreaChart({
  values,
  days,
  label,
  tone,
  max,
  fromZero = true,
  className,
}: AreaChartProps) {
  const gradient = useId()
  const look = TONES[tone]
  const top = max ?? Math.max(0, ...values)
  const low = fromZero ? 0 : Math.min(top, ...values)
  const span = top - low

  const point = (value: number, index: number): [number, number] => {
    const share = span > 0 ? Math.min(Math.max((value - low) / span, 0), 1) : 0
    const x =
      values.length > 1 ? SIDE + (index * (WIDTH - 2 * SIDE)) / (values.length - 1) : WIDTH / 2
    return [x, BASE - share * (BASE - TOP)]
  }
  const points = values.map(point)
  const line = smoothLinePath(points)
  const last = points[points.length - 1]
  const first = points[0]
  const middle = Math.floor((days.length - 1) / 2)

  return (
    <div role="img" aria-label={label} className={cn('w-full', className)}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={cn('block h-28 w-full overflow-visible', look.text)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity={0.4} />
            <stop offset="1" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[TOP, (TOP + BASE) / 2].map((y) => (
          <line
            key={y}
            x1={SIDE}
            x2={WIDTH - SIDE}
            y1={y}
            y2={y}
            strokeWidth={1}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
            className="stroke-border"
          />
        ))}
        <line
          x1={SIDE}
          x2={WIDTH - SIDE}
          y1={BASE}
          y2={BASE}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          className="stroke-border"
        />
        {points.length > 1 ? (
          <>
            <path
              d={`${line} L${last[0]},${BASE} L${first[0]},${BASE} Z`}
              fill={`url(#${gradient})`}
              stroke="none"
            />
            <path
              d={line}
              fill="none"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={look.stroke}
            />
          </>
        ) : null}
        {last ? (
          <>
            <line
              data-testid="area-chart-halo"
              x1={last[0]}
              y1={last[1]}
              x2={last[0]}
              y2={last[1]}
              strokeWidth={14}
              strokeLinecap="round"
              strokeOpacity={0.22}
              vectorEffect="non-scaling-stroke"
              className={look.stroke}
            />
            <line
              data-testid="area-chart-marker"
              x1={last[0]}
              y1={last[1]}
              x2={last[0]}
              y2={last[1]}
              strokeWidth={7}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={look.stroke}
            />
          </>
        ) : null}
      </svg>
      {days.length > 0 ? (
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums"
        >
          <span>{dayLabel(days[0])}</span>
          {days.length > 2 ? <span>{dayLabel(days[middle])}</span> : null}
          {days.length > 1 ? <span>Today</span> : null}
        </div>
      ) : null}
    </div>
  )
}
