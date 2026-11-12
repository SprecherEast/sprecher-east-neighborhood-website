import React from 'react'

import { Tabs } from '@/platform/ui/Tabs.client'
import { Text } from '@/platform/ui/Text'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const SAMPLE_TABS = [
  {
    value: 'day',
    trigger: 'Daily',
    heading: 'Day-to-day money',
    text: 'What the City spends in a year on services.',
  },
  {
    value: 'projects',
    trigger: 'Roads',
    heading: 'Big-project money',
    text: 'What the City builds and repairs, paid over many years.',
  },
  {
    value: 'home',
    trigger: 'One home',
    heading: 'One home',
    text: 'What it means for the average home.',
  },
  { value: 'dates', trigger: 'Dates', heading: 'Dates', text: 'When the Council votes.' },
]

/** Sample tabs whose panels are server-rendered text */
function sampleItems(count: number) {
  return SAMPLE_TABS.slice(0, count).map(({ text, ...tab }) => ({
    ...tab,
    panel: <Text variant="small">{text}</Text>,
  }))
}

/** The tabs: every panel is rendered by the server, so they read without JavaScript */
export function TabsGallery() {
  return (
    <GalleryEntry
      name="Tabs"
      description="Radix Tabs with every panel rendered by the server. With scripting off the tab list is hidden and each panel shows under its heading; with it on, one panel shows. The buttons are plain and equal, one row above the panel: the label centred on one line, the selected one with the primary border and a soft primary fill."
    >
      <GalleryVariant label="four tabs, one row at every width" className="block">
        <Tabs label="Sample views" defaultValue="day" items={sampleItems(4)} />
      </GalleryVariant>
      <GalleryVariant label="two tabs" className="block">
        <Tabs label="Two sample views" defaultValue="day" items={sampleItems(2)} />
      </GalleryVariant>
      <GalleryVariant label="three tabs, the second selected, headings at h4" className="block">
        <Tabs
          label="Three sample views"
          defaultValue="projects"
          headingAs="h4"
          items={sampleItems(3)}
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
