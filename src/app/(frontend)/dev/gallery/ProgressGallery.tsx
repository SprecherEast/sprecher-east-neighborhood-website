import React from 'react'

import { AmountBar } from '@/platform/ui/AmountBar'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { SharePie, type SharePieSlice } from '@/platform/ui/SharePie.client'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const SLICES: SharePieSlice[] = [
  { key: 'a', name: 'Sample: first', amount: '$4,650', percent: 46, share: 46.5, tone: 'light' },
  {
    key: 'b',
    name: 'Sample: second',
    amount: '$3,750',
    percent: 38,
    share: 37.5,
    tone: 'highlight',
  },
  { key: 'c', name: 'Sample: third', amount: '$1,250', percent: 13, share: 12.5, tone: 'medium' },
  { key: 'd', name: 'Sample: fourth', amount: '$350', percent: 3, share: 3.5, tone: 'dark' },
]

/** The progress bar: both sizes, empty and full; and the share bar */
export function ProgressGallery() {
  return (
    <GalleryEntry
      name="ProgressBar"
      description="How far along something is; always written out beside it."
    >
      {(['md', 'sm'] as const).map((size) => (
        <GalleryVariant key={size} label={`size ${size}`} className="block max-w-md">
          <ProgressBar value={3} max={8} size={size} label="Sample: 3 of 8 done" />
        </GalleryVariant>
      ))}
      <GalleryVariant label="empty, and full" className="block max-w-md space-y-3">
        <ProgressBar value={0} max={0} label="Sample: nothing to count yet" />
        <ProgressBar value={8} max={8} label="Sample: 8 of 8 done" />
      </GalleryVariant>
    </GalleryEntry>
  )
}

/** The share pie: one whole in wedges, one highlighted, at a wide and a narrow width */
export function SharePieGallery() {
  return (
    <GalleryEntry
      name="SharePie"
      description="One whole as a pie of wedges as big as their shares; a wedge writes what fits and the legend lists the rest."
    >
      <GalleryVariant
        label="wide: the thin wedge keeps its percent inside"
        className="block max-w-xl"
      >
        <SharePie slices={SLICES} label="Sample: a whole split in four" />
      </GalleryVariant>
      <GalleryVariant label="narrow: the thin wedge moves to the legend" className="block max-w-xs">
        <SharePie slices={SLICES} label="Sample: a whole split in four, narrow" />
      </GalleryVariant>
    </GalleryEntry>
  )
}

/** One amount as a bar of parts, the last year's and the proposed increase hatched */
export function AmountBarGallery() {
  return (
    <GalleryEntry
      name="AmountBar"
      description="One amount as a single bar split into parts, each as wide as its share; an added amount is hatched."
    >
      <GalleryVariant label="with a proposed increase" className="block max-w-3xl">
        <AmountBar
          title="Sample: 2027 proposed"
          total="$3,466"
          parts={[
            { key: 'same', label: 'Same as 2026', value: 3376, amount: '$3,376' },
            { key: 'more', label: 'Proposed increase', value: 90, amount: '+$90', hatch: true },
          ]}
        />
      </GalleryVariant>
      <GalleryVariant label="one part" className="block max-w-3xl">
        <AmountBar
          title="Sample: 2026 adopted"
          total="$3,376"
          parts={[{ key: 'same', label: 'Same as 2026', value: 3376, amount: '$3,376' }]}
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
