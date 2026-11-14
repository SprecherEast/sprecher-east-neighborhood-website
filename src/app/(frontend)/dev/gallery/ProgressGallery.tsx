import React from 'react'

import { ProgressBar } from '@/platform/ui/ProgressBar'
import { AreaChart } from '@/platform/ui/AreaChart'
import { HeatMap } from '@/platform/ui/HeatMap'
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

const SAMPLE_DAYS = [
  '2026-10-31',
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
]

/** The graph for activity over time: a busy count, a running total and a quiet series, all by day */
export function AreaChartGallery() {
  return (
    <GalleryEntry
      name="AreaChart"
      description="How much happened over time as a smooth filled curve with a day timeline and a marker on today; the figure is always written beside it."
    >
      <GalleryVariant label="done: a count per day, from zero" className="block max-w-sm">
        <AreaChart
          tone="done"
          days={SAMPLE_DAYS}
          values={[7, 4, 2, 6, 7, 6, 14, 19, 2, 9, 8, 17, 8, 10]}
          label="Sample: finished per day, 2 to 19"
        />
      </GalleryVariant>
      <GalleryVariant
        label="done: a running total, from its lowest value"
        className="block max-w-sm"
      >
        <AreaChart
          tone="done"
          fromZero={false}
          days={SAMPLE_DAYS}
          values={[163, 170, 174, 176, 183, 189, 195, 207, 226, 228, 237, 245, 262, 276]}
          label="Sample: done in all, 163 to 276"
        />
      </GalleryVariant>
      <GalleryVariant label="open, and nothing finished" className="block max-w-sm space-y-4">
        <AreaChart
          tone="open"
          fromZero={false}
          days={SAMPLE_DAYS}
          values={[60, 60, 82, 102, 99, 102, 123, 131, 149, 155, 169, 175, 176, 175]}
          label="Sample: still open, 60 to 175"
        />
        <AreaChart
          tone="done"
          days={SAMPLE_DAYS}
          values={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
          max={19}
          label="Sample: nothing finished"
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}

const HEAT_WEEK = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
const HEAT_WEEKS = Array.from({ length: 26 }, (_, i) => {
  return new Date(Date.UTC(2026, 9, 20 + i)).toISOString().slice(0, 10)
})

/** The day-by-day squares: a week strip across its box and four weeks as Monday rows */
export function HeatMapGallery() {
  return (
    <GalleryEntry
      name="HeatMap"
      description="How much happened each day, as squares: darker means more. The last day is ringed; the numbers are always written beside it."
    >
      <GalleryVariant label="week, full width" className="block max-w-sm">
        <HeatMap
          variant="week"
          days={HEAT_WEEK}
          values={[0, 2, 5, 1, 3]}
          label="Sample: finished this week, 0, 2, 5, 1, 3"
        />
      </GalleryVariant>
      <GalleryVariant label="week, nothing happened" className="block max-w-sm">
        <HeatMap
          variant="week"
          days={HEAT_WEEK}
          values={[0, 0, 0, 0, 0]}
          label="Sample: nothing finished"
        />
      </GalleryVariant>
      <GalleryVariant label="calendar, four weeks" className="block">
        <HeatMap
          variant="calendar"
          days={HEAT_WEEKS}
          values={HEAT_WEEKS.map((_, i) => (i * 7) % 6)}
          label="Sample: finished each day over four weeks"
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
