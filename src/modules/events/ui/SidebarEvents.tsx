import Link from 'next/link'
import React from 'react'

import { formatDateBadge } from '@/platform/lib/formatDateTime'
import { Text } from '@/platform/ui/Text'

import { formatEventCategories } from '../domain/categories'
import type { EventSummary } from '../domain/types'
import { EventTitleLabels } from './EventTitleLabels'

export const SidebarEvents: React.FC<{
  events: EventSummary[]
  title?: string
}> = ({ events, title = 'Upcoming Events' }) => {
  if (!events || events.length === 0) return null

  return (
    <div>
      <Text variant="label" as="h3" className="mb-4">
        {title}
      </Text>
      <ul className="space-y-4">
        {events.map((event) => {
          const { month, day } = formatDateBadge(event.date)

          return (
            <li key={event.slug}>
              <Link href={`/events/${event.slug}`} className="group flex gap-3">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary-strong">
                  <span className="text-xs leading-none font-medium uppercase">{month}</span>
                  <span className="text-lg leading-tight font-bold">{day}</span>
                </div>
                <div className="min-w-0">
                  <EventTitleLabels event={event} className="mb-1" />
                  <span className="block text-sm leading-snug font-medium text-foreground group-hover:text-primary">
                    {event.title}
                  </span>
                  {event.categories.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatEventCategories(event.categories)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
