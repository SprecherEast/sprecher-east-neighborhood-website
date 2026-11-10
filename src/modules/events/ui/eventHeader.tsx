import React from 'react'

import { siteTimeZoneLabel } from '@/platform/lib/timezone'
import { Badge, BadgeList } from '@/platform/ui/Badge'
import { DateTime } from '@/platform/ui/DateTime'
import type { LabelledMetaItem } from '@/platform/ui/MetaList'
import type { PageHeaderProps } from '@/platform/ui/PageHeader'

import { formatEventLocationType } from '../domain/locationTypes'
import { formatOfficialBody } from '../domain/officialMeetings'
import type { EventDetail } from '../domain/types'
import { CancelledBadge } from '@/platform/ui/CancelledBadge'
import { OfficialMeetingBadge } from './OfficialMeetingBadge'

/**
 * An event's when and where (#1002), for the page's metadata bar: the date with its time, and the
 * place with its format. Every fact the title band's row showed is kept: the date, the time, the
 * place (a venue too, now that it sits in the bar beside the Location panel's address) and the
 * format. A virtual event's format is already said by "Online", so it is not said twice.
 */
export function eventByline(event: EventDetail): LabelledMetaItem[] {
  const { date, locationType, place, timeEnd, timeStart } = event
  const time = timeStart
    ? `${timeStart}${timeEnd ? ` – ${timeEnd}` : ''} ${siteTimeZoneLabel()}`
    : null
  const format =
    locationType && place.kind !== 'online' ? formatEventLocationType(locationType) : null

  return [
    {
      label: 'When',
      value: (
        <>
          <DateTime value={date} format="long" />
          {time && ` · ${time}`}
        </>
      ),
    },
    { label: 'Where', value: format ? `${place.label} · ${format}` : place.label },
  ]
}

/**
 * The top of an event's page as `PageHeader` props (#461): its categories and title on a plain
 * band, whether or not it has a picture, which `FeaturedImage` shows in the article (#1013). A
 * cancelled event's "Cancelled" label leads the eyebrow, and an official meeting's body follows it,
 * as in "City of Madison meeting" (#122). Its when and where are `eventByline`, in the article
 * column (#1002).
 */
export function eventHeaderProps(event: EventDetail): PageHeaderProps {
  const { cancelled, categories, officialBody, title } = event
  const eyebrow =
    cancelled || officialBody || categories.length > 0 ? (
      <BadgeList>
        {cancelled && <CancelledBadge variant="status" />}
        {officialBody && (
          <OfficialMeetingBadge variant="official">
            {formatOfficialBody(officialBody)} meeting
          </OfficialMeetingBadge>
        )}
        {categories.map((category) => (
          <Badge key={category.id} variant="category">
            {category.title}
          </Badge>
        ))}
      </BadgeList>
    ) : undefined

  return { variant: 'band', eyebrow, title }
}
