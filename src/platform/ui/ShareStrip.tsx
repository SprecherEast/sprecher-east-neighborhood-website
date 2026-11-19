import React from 'react'

import { cn } from '@/platform/lib/cn'

import { SHARE_TONES, type ShareTone } from './shareTones'

export type ShareStripPart = {
  name: string
  /** Its share of the whole, 0 to 100 */
  percent: number
  tone: ShareTone
}

/**
 * A whole as one slim row of colored segments, each as wide as its share and in its tone (the same
 * colors as the bill's bars, #1266). It carries no numbers of its own: one label tells screen readers
 * every part and its percent. The caller sets any spacing through `className`.
 */
export function ShareStrip({
  parts,
  label,
  className,
}: {
  parts: readonly ShareStripPart[]
  /** What the row shows, which the spoken label starts with */
  label: string
  className?: string
}) {
  if (!parts.some(({ percent }) => percent > 0)) return null

  const spoken = `${label}: ${parts.map(({ name, percent }) => `${name} ${percent}%`).join(', ')}`
  // Each segment starts where the ones before it end
  const starts = parts.map((_, index) =>
    parts.slice(0, index).reduce((sum, part) => sum + part.percent, 0),
  )
  return (
    <svg
      role="img"
      aria-label={spoken}
      focusable="false"
      className={cn('block h-[7px] w-full overflow-hidden rounded-full', className)}
    >
      {parts.map(({ name, percent, tone }, index) => {
        return (
          <rect
            key={name}
            data-share-strip-segment={name}
            x={`${starts[index]}%`}
            width={`${percent}%`}
            height="100%"
            className={SHARE_TONES[tone].fill}
          />
        )
      })}
    </svg>
  )
}
