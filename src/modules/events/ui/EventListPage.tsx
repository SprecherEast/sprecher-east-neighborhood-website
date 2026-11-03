import { notFound } from 'next/navigation'
import React from 'react'

import { PageHeader } from '@/platform/ui/PageHeader'

import { eventListTitle, eventsHref, type EventCategoryFilter } from '../domain/filters'
import type { EventScope } from '../domain/scope'
import { findEventPage } from '../use-cases/findEventPage'
import { EventsFeed } from './EventsFeed.client'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

type EventListPageProps = {
  scope: EventScope
  page: number
  /** The filter the list keeps (#122), or `null` for every event */
  category?: EventCategoryFilter | null
}

/**
 * A crawlable, no-JavaScript page of the upcoming or past listing: /events and each category's
 * page load more as you scroll, and their "Load more" links here when JavaScript is unavailable.
 * A page past the end is not found.
 */
export async function EventListPage({ scope, page, category = null }: EventListPageProps) {
  const events = await findEventPage(scope, page, category)
  if (page > 1 && page > events.totalPages) notFound()

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow={`Community Calendar · Page ${page}`}
        title={eventListTitle(scope, category?.title)}
        backLink={{
          href: eventsHref(category?.slug),
          label: category ? `Back to all ${category.title} events` : 'Back to all events',
        }}
      />
      <section className="container">
        <EventsFeed scope={scope} initial={events} category={category} headingLevel="h2" />
      </section>
    </div>
  )
}
