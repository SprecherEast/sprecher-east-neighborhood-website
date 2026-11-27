import React from 'react'

import { ChangeFigure } from '@/platform/ui/ChangeFigure'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** One big figure and its signed change: up, down and no change, wide and narrow (#1503) */
export function ChangeFigureGallery() {
  const since = '2026 adopted'
  return (
    <GalleryEntry
      name="ChangeFigure"
      description="One figure and how it changed: the label, the figure, then an arrow, the signed amount and percent and what it is measured from. The sign is in the text and a screen reader hears Up, Down or No change, so colour is never the cue; the change is neutral on purpose, since more or less money is not good or bad by itself."
    >
      <GalleryVariant label="up" className="block max-w-xs">
        <ChangeFigure
          label="2027 adopted"
          value="$477.7M"
          change={{ direction: 'up', amount: '+$25M', percent: '+5.5%', since }}
        />
      </GalleryVariant>
      <GalleryVariant label="down" className="block max-w-xs">
        <ChangeFigure
          label="Other sources"
          value="$111.2M"
          change={{ direction: 'down', amount: '−$3.4M', percent: '−2.9%', since }}
        />
      </GalleryVariant>
      <GalleryVariant label="no change, nothing before to compare" className="block max-w-xs">
        <ChangeFigure
          label="A new fund"
          value="$2M"
          change={{ direction: 'same', amount: '$0', percent: null, since }}
        />
      </GalleryVariant>
      <GalleryVariant
        label="narrow, long text wraps without breaking the figure"
        className="block max-w-[14rem]"
      >
        <ChangeFigure
          label="2027 adopted, general and library funds"
          value="$477.7M"
          change={{
            direction: 'up',
            amount: '+$25M',
            percent: '+5.5%',
            since: '2026 adopted budget',
          }}
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
