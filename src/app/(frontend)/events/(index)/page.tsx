import type { Metadata } from 'next/types'

import React from 'react'

import { EventsOverview, findEventPage } from '@/modules/events/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function EventsPage() {
  // First page of each list is rendered on the server; the rest loads as the reader scrolls.
  const [upcoming, past] = await Promise.all([
    findEventPage('upcoming', 1),
    findEventPage('past', 1),
  ])

  return <EventsOverview upcoming={upcoming} past={past} />
}

export function generateMetadata(): Metadata {
  const title = 'Community Events'
  const description =
    'Upcoming events in the Sprecher East neighborhood — meetings, socials, volunteer opportunities, and more.'

  return {
    title,
    description,
    openGraph: mergeOpenGraph({ title, description }),
  }
}
