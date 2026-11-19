import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { EventsOverview, findEventCategory, findEventPage } from '@/modules/events/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'

// A scheduled publish or unpublish runs outside a request, where Next can't refresh the cache, so
// the page also re-renders every 10 minutes (#141, decision 0011)
export const revalidate = 600

/**
 * No pages at build time (the release is built without content); each category's page is rendered
 * on its first visit and then cached like /events. The proxy turns away malformed slugs first.
 */
export function generateStaticParams() {
  return []
}

type Args = {
  params: Promise<{ category: string }>
}

/** /events filtered to one category (#122): the filter row marks it, in the shared layout. */
export default async function EventCategoryPage({ params }: Args) {
  const category = await findEventCategory((await params).category)
  if (!category) notFound()

  const [upcoming, past] = await Promise.all([
    findEventPage('upcoming', 1, category),
    findEventPage('past', 1, category),
  ])

  return <EventsOverview upcoming={upcoming} past={past} category={category} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const category = await findEventCategory((await params).category)
  if (!category) return { title: 'Events' }

  const title = `${category.title} Events`
  const description = `${category.title} events in and around the Sprecher East neighborhood, upcoming and past.`
  return { title, description, openGraph: mergeOpenGraph({ title, description }) }
}
