import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { eventListTitle, isEventScope } from '@/modules/events'
import { EventListPage } from '@/modules/events/server'
import { parsePageNumber } from '@/platform/lib'

export const revalidate = 600

/** No pages at build time; each one is rendered on first visit and then cached like ISR. */
export function generateStaticParams() {
  return []
}

type Args = {
  params: Promise<{ scope: string; page: string }>
}

/**
 * Crawlable, no-JavaScript fallback for the events listing. /events loads more as you
 * scroll; its "Load more" control links here when JavaScript is unavailable.
 */
export default async function EventsListPage({ params: paramsPromise }: Args) {
  const { scope, page: pageParam } = await paramsPromise
  const page = parsePageNumber(pageParam)
  if (!isEventScope(scope) || page === null) notFound()

  return <EventListPage scope={scope} page={page} />
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { scope, page } = await paramsPromise
  const title = isEventScope(scope) ? eventListTitle(scope) : 'Events'
  return { title: `${title} — Page ${page}` }
}
