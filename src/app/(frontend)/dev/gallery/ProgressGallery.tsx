import React from 'react'

import { ProgressBar } from '@/platform/ui/ProgressBar'
import { AreaChart } from '@/platform/ui/AreaChart'
import { HeatMap } from '@/platform/ui/HeatMap'
import { Disclosure } from '@/platform/ui/Disclosure'
import { BarTrack } from '@/platform/ui/BarTrack'
import { ShareBill, type ShareSlice } from '@/platform/ui/ShareBill'
import { ShareStrip } from '@/platform/ui/ShareStrip'
import { Text } from '@/platform/ui/Text'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import { HeatMapSelectable } from './HeatMapSelectable.client'

const SLICES: ShareSlice[] = [
  {
    key: 'a',
    name: 'Sample: first',
    amount: '$3,750',
    percent: 38,
    share: 37.5,
    tone: 'amber',
  },
  { key: 'b', name: 'Sample: second', amount: '$4,650', percent: 46, share: 46.5, tone: 'rust' },
  { key: 'c', name: 'Sample: third', amount: '$1,250', percent: 13, share: 12.5, tone: 'green' },
  { key: 'd', name: 'Sample: fourth', amount: '$350', percent: 3, share: 3.5, tone: 'mint' },
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

/** One bar on its track: the part the bill's rows and the breakdown's rows share */
export function BarTrackGallery() {
  return (
    <GalleryEntry name="BarTrack" description="One bar on a muted track, as wide as its share">
      <GalleryVariant label="Half and a full bar" className="block space-y-2">
        <BarTrack
          width={50}
          radius={5}
          className="h-2.5"
          fillClassName="fill-primary-fill"
          mark={{ 'data-sample-bar': 'half' }}
        />
        <BarTrack
          width={100}
          radius={5}
          className="h-2.5"
          fillClassName="fill-muted-foreground/45"
          mark={{ 'data-sample-bar': 'full' }}
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}

/** A whole as one slim row of colored segments: the thin bar a content column can show (#1266) */
export function ShareStripGallery() {
  return (
    <GalleryEntry
      name="ShareStrip"
      description="A whole as one slim row, each part as wide as its share"
    >
      <GalleryVariant label="Four parts" className="block">
        <ShareStrip
          label="Sample"
          parts={[
            { name: 'First', percent: 50, tone: 'rust' },
            { name: 'Second', percent: 30, tone: 'amber' },
            { name: 'Third', percent: 15, tone: 'green' },
            { name: 'Fourth', percent: 5, tone: 'mint' },
          ]}
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

const HEAT_MONTH = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)

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
      <GalleryVariant label="week, days to press" className="block max-w-sm">
        <HeatMapSelectable />
      </GalleryVariant>
      <GalleryVariant label="week, two days enabled" className="block max-w-sm">
        <HeatMapSelectable limited />
      </GalleryVariant>
      <GalleryVariant
        label="calendar, four weeks, full width, with caption and key"
        className="block"
      >
        <HeatMap
          caption="Work done per day"
          variant="calendar"
          days={HEAT_WEEKS}
          values={HEAT_WEEKS.map((_, i) => (i * 7) % 6)}
          label="Sample: finished each day over four weeks"
        />
      </GalleryVariant>
      <GalleryVariant
        label="calendar, a past month, no today and no days to come"
        className="block"
      >
        <HeatMap
          caption="Work done per day"
          variant="calendar"
          days={HEAT_MONTH}
          values={HEAT_MONTH.map((_, i) => (i * 5) % 7)}
          today={null}
          toCome={false}
          label="Sample: finished each day in October"
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
