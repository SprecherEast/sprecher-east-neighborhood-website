import React from 'react'

import type { FeedPage } from '@/platform/lib'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Text } from '@/platform/ui/Text'

import type { EventCategoryFilter } from '../domain/filters'
import type { EventSummary } from '../domain/types'
import { EventsFeed } from './EventsFeed.client'

type EventsOverviewProps = {
  upcoming: FeedPage<EventSummary>
  past: FeedPage<EventSummary>
  /** The filter shown (#122), or `null` for every event */
  category?: Pick<EventCategoryFilter, 'slug' | 'title'> | null
}

/**
 * The body of /events and of each category's page: the first page of upcoming events, then of
 * past events; the rest loads as the reader scrolls.
 */
export function EventsOverview({ upcoming, past, category = null }: EventsOverviewProps) {
  const which = category ? `${category.title} events` : 'events'

  return (
    <>
      <section aria-labelledby="upcoming-heading" className="container mb-16">
        <Text variant="section" id="upcoming-heading" className="mb-8">
          Upcoming Events
        </Text>
        {upcoming.totalDocs > 0 ? (
          <EventsFeed scope="upcoming" initial={upcoming} category={category} />
        ) : (
          <EmptyState
            title={`No upcoming ${which} are posted right now.`}
            description={
              // Point to past events only when the page shows some (#206)
              past.totalDocs > 0
                ? 'Check back soon, or browse past events below to see what neighbors have been up to.'
                : 'Check back soon.'
            }
          />
        )}
      </section>

      {past.totalDocs > 0 && (
        <section aria-labelledby="past-heading" className="border-t border-border bg-surface py-16">
          <div className="container">
            <Text variant="section" id="past-heading" className="mb-8">
              Past Events
            </Text>
            <EventsFeed scope="past" initial={past} category={category} />
          </div>
        </section>
      )}
    </>
  )
}
