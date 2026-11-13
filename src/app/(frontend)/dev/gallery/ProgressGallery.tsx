import React from 'react'

import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Sparkline } from '@/platform/ui/Sparkline'
import { ShareBar } from '@/platform/ui/ShareBar.client'
import { Disclosure } from '@/platform/ui/Disclosure'
import { ShareBill, type ShareSlice } from '@/platform/ui/ShareBill'
import { Text } from '@/platform/ui/Text'

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
      description="One whole as a flat bar of slices as wide as their shares; every slice shows its percent, and a slice too narrow for it is drawn wider, the extra taken from the others."
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

/** The whole bill: its title, the bar, the receipt and the total, wide and narrow */
export function ShareBillGallery() {
  return (
    <GalleryEntry
      name="ShareBill"
      description="One whole as a bill, like a receipt: the title, one bar of slices as wide as their shares, and a receipt that names each with its color, percent and dollars, and the total as the last line."
    >
      <GalleryVariant label="wide" className="block max-w-xl">
        <ShareBill
          slices={SLICES}
          label="Sample: a whole split in four"
          title="Sample: whole bill"
          total={{ label: 'Sample total', amount: '$10,000' }}
        />
      </GalleryVariant>
      <GalleryVariant label="a row nested under the highlighted slice" className="block max-w-xl">
        <ShareBill
          slices={SLICES}
          label="Sample: a whole split in four, with a nested row"
          title="Sample: whole bill"
          total={{ label: 'Sample total', amount: '$10,000' }}
          nested={{
            after: SLICES[0]?.key ?? '',
            children: (
              <Disclosure variant="listRow" summary="Sample: more on the first slice">
                <Text variant="small">Sample: what the first slice pays for.</Text>
              </Disclosure>
            ),
          }}
        />
      </GalleryVariant>
      <GalleryVariant label="narrow" className="block max-w-xs">
        <ShareBill
          slices={SLICES}
          label="Sample: a whole split in four, narrow"
          title="Sample: whole bill"
          total={{ label: 'Sample total', amount: '$10,000' }}
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}

/** The activity line: a busy series, a quiet one and a single value, on one shared scale */
export function SparklineGallery() {
  return (
    <GalleryEntry
      name="Sparkline"
      description="How much happened over time, as a thin line on a scale shared by the pictures read together; the numbers are always written beside it."
    >
      <GalleryVariant
        label="busy, quiet and none, on one scale"
        className="block max-w-xs space-y-3"
      >
        <Sparkline values={[1, 3, 2, 6, 4, 8, 5, 7]} max={8} label="Sample: busy, 1 to 8 a week" />
        <Sparkline values={[0, 1, 0, 0, 2, 0, 1, 0]} max={8} label="Sample: quiet, 0 to 2 a week" />
        <Sparkline values={[0, 0, 0, 0, 0, 0, 0, 0]} max={8} label="Sample: nothing finished" />
      </GalleryVariant>
      <GalleryVariant label="one value" className="block max-w-xs">
        <Sparkline values={[4]} max={8} label="Sample: one value, 4" />
      </GalleryVariant>
    </GalleryEntry>
  )
}
