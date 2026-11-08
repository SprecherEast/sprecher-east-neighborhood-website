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
 * The top of an event's page as `PageHeader` props (#461): its categories, title, date, time and
 * format, on its photo (`image`), or plain (`default`) when it has none. A cancelled event's
 * "Cancelled" label leads the eyebrow, and an official meeting's body follows it, as in
 * "City of Madison meeting" (#122).
 */
export function eventHeaderProps(event: EventDetail): PageHeaderProps {
  const {
    cancelled,
    categories,
    date,
    image,
    locationType,
    officialBody,
    place,
    timeEnd,
    timeStart,
    title,
  } = event
  const facts: LabelledMetaItem[] = [
    { label: 'Date', value: <DateTime value={date} format="long" /> },
    ...(timeStart
      ? [
          {
            label: 'Time',
            value: `${timeStart}${timeEnd ? ` – ${timeEnd}` : ''} ${siteTimeZoneLabel()}`,
          },
        ]
      : []),
    // A venue is in the Location panel below with its address and map link; saying it twice is noise
    ...(place.kind === 'venue' ? [] : [{ label: 'Location', value: place.label }]),
    ...(locationType ? [{ label: 'Format', value: formatEventLocationType(locationType) }] : []),
  ]
  const badge = image ? 'on-image' : 'category'
  const eyebrow =
    cancelled || officialBody || categories.length > 0 ? (
      <BadgeList>
        {cancelled && <CancelledBadge variant={image ? 'on-image' : 'status'} />}
        {officialBody && (
          <OfficialMeetingBadge variant={image ? 'on-image' : 'official'}>
            {formatOfficialBody(officialBody)} meeting
          </OfficialMeetingBadge>
        )}
        {categories.map((category) => (
          <Badge key={category.id} variant={badge}>
            {category.title}
          </Badge>
        ))}
      </BadgeList>
    ) : undefined

  return image ? { variant: 'image', image, eyebrow, title, facts } : { eyebrow, title, facts }
}
