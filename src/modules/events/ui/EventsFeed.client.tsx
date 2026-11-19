'use client'

import React, { useCallback } from 'react'

import { LoadMoreFooter, useLoadMore } from '@/platform/ui/LoadMore.client'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import type { FeedPage } from '@/platform/lib'

import { loadMoreEvents } from '../actions'
import { eventsListHref, type EventCategoryFilter } from '../domain/filters'
import type { EventScope } from '../domain/scope'
import type { EventSummary } from '../domain/types'
import { EventCard } from './EventCard'

/**
 * Upcoming or past events grid that loads more events as the reader scrolls. With a `category`,
 * "Load more" and its no-JavaScript link keep that filter (#122).
 */
export const EventsFeed: React.FC<{
  scope: EventScope
  initial: FeedPage<EventSummary>
  category?: Pick<EventCategoryFilter, 'slug' | 'title'> | null
  /** The cards' heading level: `h2` where no heading sits between the page's `h1` and the list */
  headingLevel?: 'h2' | 'h3'
}> = ({ scope, initial, category = null, headingLevel }) => {
  const slug = category?.slug ?? null
  const load = useCallback((cursor: string) => loadMoreEvents(scope, cursor, slug), [scope, slug])
  const feed = useLoadMore(initial, load)
  const compact = scope === 'past'
  const noun = category ? `${scope} ${category.title} events` : `${scope} events`

  return (
    <>
      <CardGrid gap={compact ? 'sm' : 'md'}>
        {feed.items.map((event) => (
          <CardGridItem key={event.id}>
            <EventCard event={event} compact={compact} headingLevel={headingLevel} />
          </CardGridItem>
        ))}
      </CardGrid>
      <LoadMoreFooter
        noun={noun}
        shownCount={feed.items.length}
        firstItemNumber={feed.firstItemNumber}
        totalDocs={feed.totalDocs}
        hasMore={feed.hasMore}
        status={feed.status}
        autoLoad={feed.autoLoad}
        onLoadMore={feed.loadMore}
        fallbackHref={eventsListHref(scope, feed.nextPage, slug)}
      />
    </>
  )
}
