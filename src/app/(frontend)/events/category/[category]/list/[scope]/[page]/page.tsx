import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { eventListTitle, isEventScope } from '@/modules/events'
import { EventListPage, findEventCategory } from '@/modules/events/server'
import { parsePageNumber } from '@/platform/lib'

export const revalidate = 600

/** No pages at build time; each one is rendered on first visit and then cached like ISR. */
export function generateStaticParams() {
  return []
}

type Args = {
  params: Promise<{ category: string; scope: string; page: string }>
}

/**
 * The no-JavaScript "Load more" pages of one category (#122), as /events/list/<scope>/<n> is for
 * every event: /events/category/<slug> links here when JavaScript is unavailable.
 */
export default async function EventCategoryListPage({ params }: Args) {
  const { category: slug, scope, page: pageParam } = await params
  const page = parsePageNumber(pageParam)
  if (!isEventScope(scope) || page === null) notFound()
  const category = await findEventCategory(slug)
  if (!category) notFound()

  return <EventListPage scope={scope} page={page} category={category} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category: slug, scope, page } = await params
  const category = await findEventCategory(slug)
  const title = isEventScope(scope) ? eventListTitle(scope, category?.title) : 'Events'
  return { title: `${title} — Page ${page}` }
}
