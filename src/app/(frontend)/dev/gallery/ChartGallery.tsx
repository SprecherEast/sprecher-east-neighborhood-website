import React from 'react'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { Chart } from '@/platform/ui/chart/Chart'
import { textAdapter } from '@/platform/ui/chart/adapters/text/textAdapter'
import { SpikeBars } from '@/platform/ui/chart/adapters/visx/SpikeBars'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** The chart: each kind and mode the adapters draw today, from the City's published budget figures */
export function ChartGallery() {
  return (
    <GalleryEntry
      name="Chart"
      description="The one chart. Square grids and tiles are plain HTML (the css adapter); every other kind is words and a table (the text adapter) until the bar adapter (#663). The 2027 figures are the Mayor's proposal."
    >
      <GalleryVariant
        label="units · perHundred, two groups: 2026 adopted next to 2027 proposed"
        className="block"
      >
        <Chart spec={FIXTURES.paysFor} />
      </GalleryVariant>
      <GalleryVariant
        label="units · perHundred, one group, a different set of parts"
        className="block"
      >
        <Chart spec={FIXTURES.comesIn} />
      </GalleryVariant>
      <GalleryVariant label="units · each: twelve month tiles" className="block">
        <Chart spec={FIXTURES.months} />
      </GalleryVariant>
      <GalleryVariant label="stacked, drawn by the text adapter (the fallback)" className="block">
        <Chart spec={FIXTURES.borrowed} />
      </GalleryVariant>
      <GalleryVariant label="bar, drawn by the text adapter (the fallback)" className="block">
        <Chart spec={FIXTURES.bars} />
      </GalleryVariant>
      <GalleryVariant
        label="units forced onto the text adapter: the same grid as words"
        className="block"
      >
        <Chart spec={FIXTURES.comesIn} adapter={textAdapter} />
      </GalleryVariant>
      <GalleryVariant label="spike: visx bars (server component)" className="block">
        <SpikeBars />
      </GalleryVariant>
    </GalleryEntry>
  )
}
