import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'

import { Text } from './Text'

/** How tall the bar is, in pixels */
const BAR_HEIGHT = 20

/** The rounding of the bar's ends and of the swatches in its key */
const RADIUS = 7

export type AmountBarPart = {
  key: string
  label: string
  /** What the part is worth: widths are each part's share of the parts' total */
  value: number
  /** The amount as the reader sees it, already formatted by the caller */
  amount: string
  /** An amount added on top of the first part: drawn hatched, so it reads by pattern as well as colour */
  hatch?: boolean
}

/**
 * One amount as a single bar split into parts, each as wide as its share, with the year and the
 * whole amount above it and, when there is more than one part, each part named under it with its
 * dollars. The bar is one named
 * picture; every figure is also text. A part marked `hatch` is the proposed increase: the same
 * colour, striped, as in the charts. Widths are percent attributes, never inline styles.
 */
export function AmountBar({
  title,
  total,
  parts,
  className,
}: {
  title: string
  /** The whole amount, formatted */
  total: string
  parts: readonly AmountBarPart[]
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const pattern = `amount-hatch-${id}`
  const clip = `amount-clip-${id}`
  const sum = parts.reduce((all, part) => all + part.value, 0) || 1
  const placed = parts.map((part, index) => ({
    ...part,
    start: (parts.slice(0, index).reduce((all, earlier) => all + earlier.value, 0) / sum) * 100,
    share: (part.value / sum) * 100,
  }))
  const pct = (n: number) => `${Number(n.toFixed(3))}%`
  const hatched = parts.some((part) => part.hatch)
  const picture = `${title}: ${total}, made up of ${parts.map((p) => `${p.label} ${p.amount}`).join(' and ')}`

  return (
    <div className={cn('space-y-2', className)}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Text variant="small" as="span" className="font-semibold text-foreground">
          {title}
        </Text>
        <Text variant="lead" as="span" className="font-semibold text-foreground tabular-nums">
          {total}
        </Text>
      </p>
      <svg role="img" aria-label={picture} height={BAR_HEIGHT} className="block w-full print-exact">
        <defs>
          <clipPath id={clip}>
            <rect width="100%" height={BAR_HEIGHT} rx={RADIUS} />
          </clipPath>
          {hatched && (
            <pattern
              id={pattern}
              width={5}
              height={5}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line x1={0} y1={0} x2={0} y2={5} strokeWidth={1.5} className="stroke-card" />
            </pattern>
          )}
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="100%" height={BAR_HEIGHT} className="fill-muted" />
          {placed.map((part) => (
            <React.Fragment key={part.key}>
              <rect
                data-amount-part={part.key}
                x={pct(part.start)}
                width={pct(part.share)}
                height={BAR_HEIGHT}
                className="fill-chart-1"
              />
              {part.hatch && (
                <rect
                  data-amount-hatch=""
                  x={pct(part.start)}
                  width={pct(part.share)}
                  height={BAR_HEIGHT}
                  fill={`url(#${pattern})`}
                />
              )}
            </React.Fragment>
          ))}
        </g>
      </svg>
      {parts.length > 1 && (
        <ul role="list" className="flex flex-wrap gap-x-6 gap-y-1">
          {parts.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <svg aria-hidden="true" focusable="false" width={14} height={14} className="shrink-0">
                <rect width={14} height={14} rx={3} className="fill-chart-1" />
                {part.hatch && <rect width={14} height={14} rx={3} fill={`url(#${pattern})`} />}
              </svg>
              <Text variant="small" as="span">
                {part.label}
              </Text>
              <Text
                variant="small"
                as="span"
                className="font-semibold text-foreground tabular-nums"
              >
                {part.amount}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
