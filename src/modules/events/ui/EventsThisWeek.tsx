import { ArrowRight } from 'lucide-react'
import React, { useId } from 'react'

import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Link } from '@/platform/ui/Link'
import { Section } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

import {
  THIS_WEEK_EMPTY_MESSAGE,
  type EventsThisWeekProps,
  type EventsThisWeekRow,
} from '../domain/thisWeek'
import { EventCard } from './EventCard'

function SeeAll({ href, label }: EventsThisWeekRow['seeAll']) {
  return (
    <Link variant="action" href={href} icon={<ArrowRight aria-hidden="true" />} iconPosition="end">
      {label}
    </Link>
  )
}

function ThisWeekRow({ title, events, seeAll }: EventsThisWeekRow) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <Text variant="subsection" as="h3" id={headingId} className="mb-4">
        {title}
      </Text>
      <CardGrid gap="sm">
        {events.map((event) => (
          <CardGridItem key={event.id}>
            <EventCard event={event} compact headingLevel="h4" />
          </CardGridItem>
        ))}
      </CardGrid>
      <div className="mt-2">
        <SeeAll {...seeAll} />
      </div>
    </section>
  )
}

/**
 * The "this week" strip (#122), a page-builder block: the next few days of events in rows of
 * compact cards, each row ending with its "See all" link. Rows without events are already left
 * out; with none left, one calm message links to every event.
 */
export function EventsThisWeek({ id, heading, rows, allEventsHref }: EventsThisWeekProps) {
  const headingId = useId()

  return (
    <Section spacing="sm" id={id ? `block-${id}` : undefined} aria-labelledby={headingId}>
      <Text variant="overline" className="mb-2">
        Events
      </Text>
      <Text variant="section" id={headingId} className="mb-8">
        {heading}
      </Text>
      {rows.length > 0 ? (
        <div className="space-y-10">
          {rows.map((row, index) => (
            // Index keys: an editor may give two rows the same title
            <ThisWeekRow key={index} {...row} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={THIS_WEEK_EMPTY_MESSAGE}
          description="New events are added often. Browse everything that’s coming up."
          action={<SeeAll href={allEventsHref} label="See all events" />}
        />
      )}
    </Section>
  )
}
