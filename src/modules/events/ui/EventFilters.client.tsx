'use client'

import { useSelectedLayoutSegments } from 'next/navigation'
import React from 'react'

import { Button } from '@/platform/ui'

import { describeEventCounts, eventsHref, type EventFilterMenu } from '../domain/filters'

/**
 * The category filters of /events (#122): plain links to `/events` and `/events/category/<slug>`,
 * so they work without JavaScript, and the line saying what the filter shows. It sits in the
 * layout the filtered pages share, so it stays put while the list changes: the link pressed keeps
 * keyboard focus, and the status line, a polite live region, announces the new count.
 * `aria-current` marks the filter shown. With no categorised events there is nothing to filter,
 * and nothing is drawn.
 */
export function EventFilters({ menu }: { menu: EventFilterMenu }) {
  // Under the layout: [] on /events, ['category', '<slug>'] on a category's page
  const [segment, slug] = useSelectedLayoutSegments()
  const current =
    segment === 'category' ? (menu.categories.find((filter) => filter.slug === slug) ?? null) : null

  if (menu.categories.length === 0) return null

  const filters = [
    { key: 'all', href: eventsHref(), label: 'All', current: current === null },
    ...menu.categories.map((filter) => ({
      key: filter.slug,
      href: eventsHref(filter.slug),
      label: filter.title,
      current: filter.id === current?.id,
    })),
  ]

  return (
    <div className="container mb-12">
      <nav aria-label="Event categories">
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <li key={filter.key} className="max-w-full">
              <Button
                href={filter.href}
                size="sm"
                variant={filter.current ? 'primary' : 'secondary'}
                aria-current={filter.current ? 'page' : undefined}
                className="max-w-full [overflow-wrap:anywhere]"
              >
                {filter.label}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-muted-foreground">
        {describeEventCounts(current?.title ?? null, current?.counts ?? menu.all)}
      </p>
    </div>
  )
}
