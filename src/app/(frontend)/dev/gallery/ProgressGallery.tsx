import React from 'react'

import { AmountBar } from '@/platform/ui/AmountBar'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { ShareBar } from '@/platform/ui/ShareBar'
import { ShareBill, type ShareSlice } from '@/platform/ui/ShareBill'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const SLICES: ShareSlice[] = [
  {
    key: 'a',
    name: 'Sample: first',
    amount: '$3,750',
    percent: 38,
    share: 37.5,
    tone: 'highlight',
  },
  { key: 'b', name: 'Sample: second', amount: '$4,650', percent: 46, share: 46.5, tone: 'light' },
  { key: 'c', name: 'Sample: third', amount: '$1,250', percent: 13, share: 12.5, tone: 'medium' },
  { key: 'd', name: 'Sample: fourth', amount: '$350', percent: 3, share: 3.5, tone: 'strong' },
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

/** The share bar: one whole in slices of four tones, a narrow slice leaving its label to the text */
export function ShareBarGallery() {
  return (
    <GalleryEntry
      name="ShareBar"
      description="One whole as a flat bar of slices as wide as their shares; a slice too narrow for its label leaves it to the text beside the bar."
    >
      <GalleryVariant label="four tones, one highlighted" className="block max-w-3xl">
        <ShareBar
          slices={SLICES.map((slice) => ({
            key: slice.key,
            share: slice.share,
            tone: slice.tone,
            label: `${slice.percent}%`,
          }))}
          label="Sample: a whole split in four"
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}

/** The whole bill: the total, the bar and the receipt, wide and narrow */
export function ShareBillGallery() {
  return (
    <GalleryEntry
      name="ShareBill"
      description="One whole as a bill: the total, one bar of slices as wide as their shares, and a receipt that names each with its color, percent and dollars."
    >
      <GalleryVariant label="wide" className="block max-w-xl">
        <ShareBill
          slices={SLICES}
          label="Sample: a whole split in four"
          total={{ label: 'Sample total', amount: '$10,000' }}
        />
      </GalleryVariant>
      <GalleryVariant label="narrow" className="block max-w-xs">
        <ShareBill
          slices={SLICES}
          label="Sample: a whole split in four, narrow"
          total={{ label: 'Sample total', amount: '$10,000' }}
        />
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
