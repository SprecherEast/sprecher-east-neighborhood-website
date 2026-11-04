import React from 'react'

import { cn } from '@/platform/lib/cn'
import {
  CHART_LARGE,
  CHART_SMALL,
  CHART_THUMBNAIL_DRAWING,
  CHART_THUMBNAIL_FIGURE,
  CHART_WIDTH,
} from '@/platform/ui/layoutSizes'

/**
 * `thumbnail`: in the page, the drawing at the small width (beside the text from 40rem).
 * `enlarged`: in the dialog, the drawing at the large width, everything stacked. `plain`: words,
 * which need no width of their own.
 */
export type ChartLayoutVariant = 'thumbnail' | 'enlarged' | 'plain'

/** The pieces of a chart, each drawn by the server so `Chart` stays server code (#681) */
export type ChartParts = {
  /** The title and the takeaway, then the description that only screen readers get */
  head: React.ReactNode
  /** The adapter's drawing */
  drawing: React.ReactNode
  /** The colour key, then the `figcaption`, which HTML wants last in its `figure` */
  details: React.ReactNode
  /** "Show the numbers" */
  numbers: React.ReactNode
}

export type ChartLayoutProps = Partial<ChartParts> & {
  variant?: ChartLayoutVariant
  /** Sits right under the drawing: the Enlarge button */
  action?: React.ReactNode
  className?: string
  ref?: React.Ref<HTMLDivElement>
}

const WIDTH_CLASSES = { thumbnail: CHART_SMALL, enlarged: CHART_LARGE, plain: '' } as const

/**
 * Where a chart's pieces go (#681), shared by the plain `Chart` and the enlargeable one so the
 * markup and the sizes are written once. Pure markup with no hooks, so a client component can use
 * it too. The drawing runs `w-full` up to the size's width; `@container` makes the layout, and the
 * adapters' own grids, answer to the room they have rather than to the screen.
 */
export function ChartLayout({
  variant = 'thumbnail',
  head,
  drawing,
  details,
  numbers,
  action,
  className,
  ref,
}: ChartLayoutProps) {
  const thumbnail = variant === 'thumbnail'
  return (
    <div
      ref={ref}
      className={cn('not-prose @container space-y-3', WIDTH_CLASSES[variant], className)}
    >
      <figure className={cn('flex flex-col gap-4', thumbnail && CHART_THUMBNAIL_FIGURE)}>
        {head}
        <div
          className={cn(
            '@container w-full',
            variant !== 'plain' && CHART_WIDTH,
            thumbnail && CHART_THUMBNAIL_DRAWING,
          )}
        >
          {drawing}
          {action && <div className="mt-3">{action}</div>}
        </div>
        {details}
      </figure>
      {numbers}
    </div>
  )
}
