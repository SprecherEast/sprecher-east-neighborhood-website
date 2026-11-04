import React from 'react'

import { Tabs } from '@/platform/ui/Tabs.client'
import { Text } from '@/platform/ui/Text'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const SAMPLE_TABS = [
  {
    value: 'day',
    trigger: 'Day to day',
    heading: 'Day-to-day money',
    text: 'What the City spends in a year on services.',
  },
  {
    value: 'projects',
    trigger: 'Big projects',
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
      description="Radix Tabs with every panel rendered by the server. With scripting off the tab list is hidden and each panel shows under its heading; with it on, one panel shows."
    >
      <GalleryVariant label="four tabs: 2 by 2 on a phone, one row from sm up" className="block">
        <Tabs label="Sample views" defaultValue="day" items={sampleItems(4)} />
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
