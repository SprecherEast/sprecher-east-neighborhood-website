import React from 'react'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { Chart } from '@/platform/ui/chart/Chart'
import { textAdapter } from '@/platform/ui/chart/adapters/text/textAdapter'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** The chart: each kind and mode the adapters draw today, from the City's published budget figures */
export function ChartGallery() {
  return (
    <GalleryEntry
      name="Chart"
      description="The one chart. Square grids and tiles are plain HTML (the css adapter); bars and stacked bars are one SVG drawn on the server (the visx adapter); the text adapter, words and a table, is the fallback. A picture shows as a small thumbnail (beside its title, takeaway and caption from 40rem of room) with an Enlarge button, or a click on the drawing, that opens the same chart bigger in a modal dialog; words never do. The 2027 figures are the Mayor's proposal."
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
      <GalleryVariant
        label="bar · two bars on a shared $0 to $500M scale, 2027 hatched because it is only proposed"
        className="block"
      >
        <Chart spec={FIXTURES.bars} />
      </GalleryVariant>
      <GalleryVariant
        label="stacked · the same scale, the increase drawn hatched on top of 2026's amount (+$24.8M)"
        className="block"
      >
        <Chart spec={FIXTURES.operating} />
      </GalleryVariant>
      <GalleryVariant
        label="stacked · borrowed and other money for big projects, with a note under each row"
        className="block"
      >
        <Chart spec={FIXTURES.borrowed} />
      </GalleryVariant>
      <GalleryVariant label="stacked forced onto the text adapter (the fallback)" className="block">
        <Chart spec={FIXTURES.borrowed} adapter={textAdapter} />
      </GalleryVariant>
      <GalleryVariant
        label="units forced onto the text adapter: the same grid as words"
        className="block"
      >
        <Chart spec={FIXTURES.comesIn} adapter={textAdapter} />
      </GalleryVariant>
    </GalleryEntry>
  )
}
