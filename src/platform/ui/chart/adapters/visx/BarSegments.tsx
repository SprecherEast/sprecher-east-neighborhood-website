import { Bar, BarRounded } from '@visx/shape'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { slotAt, type ChartPalette } from '../../chartPalette'

import { BAR_HEIGHT, BAR_RADIUS, type PlacedSegment } from './barLayout'

type Props = { segment: PlacedSegment; y: number; palette: ChartPalette; patternId: string }

type ShapeProps = { className?: string; fill?: string; 'data-chart-mark'?: string }

/** One rectangle; the data end is a path rounded on its right side only, so the baseline stays square */
function shape(segment: PlacedSegment, y: number, props: ShapeProps) {
  const box = { x: segment.x, y, width: segment.width, height: BAR_HEIGHT }
  return segment.roundEnd && segment.width >= 2 * BAR_RADIUS ? (
    <BarRounded {...box} radius={BAR_RADIUS} right {...props} />
  ) : (
    <Bar {...box} {...props} />
  )
}

/**
 * One mark: the segment in its palette colour (`fill-chart-N`), with the hatch laid over it where
 * the segment is hatched. The mark holds no text; its value is a label beside it.
 */
export function BarSegment({ segment, y, palette, patternId }: Props) {
  return (
    <>
      {shape(segment, y, {
        className: cn(slotAt(palette, segment.slotIndex).fill),
        'data-chart-mark': segment.key,
      })}
      {segment.hatch && segment.width > 0 && shape(segment, y, { fill: `url(#${patternId})` })}
    </>
  )
}
