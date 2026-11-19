import React from 'react'
import { MapPin, Clock, Calendar } from 'lucide-react'

import { Media } from '@/platform/ui/Media'
import { cn } from '@/platform/lib/cn'
import { Badge, BadgeList } from '@/platform/ui/Badge'
import { Card, CardBody, CardFooter, CardMedia, CardTitle } from '@/platform/ui/Card'
import { formatDateBadge } from '@/platform/lib/formatDateTime'
import { DateTime } from '@/platform/ui/DateTime'
import { MetaList, type IconMetaItem } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import type { EventSummary } from '../domain/types'
import { EventTitleLabels } from './EventTitleLabels'

const DateBadge: React.FC<{
  date: string
  size?: 'sm' | 'lg'
  className?: string
}> = ({ date, size = 'sm', className = '' }) => {
  const { month, day } = formatDateBadge(date)
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 flex-col items-center justify-center',
        size === 'lg' ? 'h-16 w-16 rounded-xl' : 'h-14 w-14 rounded-lg',
        className,
      )}
    >
      <span className="text-xs leading-none font-bold text-primary-strong uppercase">{month}</span>
      <span
        className={cn(
          'leading-tight font-bold text-foreground',
          size === 'lg' ? 'text-2xl' : 'text-lg',
        )}
      >
        {day}
      </span>
    </div>
  )
}

/** A place on one line, cut with an ellipsis, so cards in a row stay level (#873); the event page has it in full. */
const PlaceLabel: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <Text as="span" variant="small" clamp={1} className={cn('min-w-0', className)}>
    {label}
  </Text>
)

export const EventCard: React.FC<{
  event: EventSummary
  compact?: boolean
  /** `h2` where no heading sits between the page's `h1` and the list; `h4` under a row's `h3` */
  headingLevel?: 'h2' | 'h3' | 'h4'
}> = ({ event, compact, headingLevel = 'h3' }) => {
  const { slug, title, date, timeStart, timeEnd, categories, description, place, image } = event

  if (!slug) return null

  const href = `/events/${slug}`

  if (compact) {
    return (
      <Card as="article" padding="sm" interactive className="flex items-start gap-4">
        <DateBadge date={date} className="bg-surface text-center" />
        <div className="min-w-0">
          <DateTime value={date} className="text-xs text-muted-foreground" />
          <CardTitle as={headingLevel} href={href} className="text-base">
            <EventTitleLabels event={event} className="mb-1.5" />
            {/* Two lines, not one: a phone-wide card cut "Common Council Me…" to one (#122) */}
            <span className="line-clamp-2">{title}</span>
          </CardTitle>
          <Text variant="small" className="mt-1 flex items-center gap-1.5 text-xs">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <PlaceLabel label={place.label} className="text-xs" />
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <Card as="article" padding="none" interactive>
      {/* Image area with date badge overlay */}
      <CardMedia>
        {image ? (
          <Media
            resource={image}
            fill
            imgClassName="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-surface">
            <Calendar aria-hidden="true" className="h-12 w-12 text-muted-foreground/20" />
          </div>
        )}
        <DateBadge
          date={date}
          size="lg"
          className="absolute top-3 left-3 bg-card/95 shadow-lg backdrop-blur-sm"
        />
      </CardMedia>

      <CardBody>
        <CardTitle as={headingLevel} href={href} className="mb-2">
          {/* Inside the title's link, so the link reads its labels with the title (#122) */}
          <EventTitleLabels event={event} className="mb-1.5" />
          {title}
        </CardTitle>

        {/* Date (the badge above is decorative) and time — never invent a time */}
        <MetaList
          className="mb-3 gap-1.5 text-sm text-muted-foreground"
          items={[
            {
              icon: <Clock />,
              value: (
                <>
                  <DateTime value={date} />
                  {timeStart ? ` · ${timeStart}${timeEnd ? ` – ${timeEnd}` : ''}` : ''}
                </>
              ),
            },
            { icon: <MapPin />, value: <PlaceLabel label={place.label} /> } satisfies IconMetaItem,
          ]}
        />

        {description && (
          <Text variant="small" clamp={2} className="mb-3">
            {description}
          </Text>
        )}

        {categories.length > 0 && (
          <CardFooter className="pt-0">
            <BadgeList>
              {categories.map((category) => (
                <Badge key={category.id}>{category.title}</Badge>
              ))}
            </BadgeList>
          </CardFooter>
        )}
      </CardBody>
    </Card>
  )
}
