import React from 'react'

import { cn } from '@/platform/lib/cn'

import type { EventSummary } from '../domain/types'
import { CancelledBadge } from '@/platform/ui/CancelledBadge'
import { OfficialMeetingBadge } from './OfficialMeetingBadge'

/**
 * The labels that go before an event's title inside its link, on their own line (#122):
 * "Cancelled" first, then "Official meeting". Hidden punctuation makes the link read
 * "Cancelled, Official meeting: <title>". Nothing for an event with neither.
 */
export function EventTitleLabels({
  event: { cancelled, officialBody },
  className,
}: {
  event: Pick<EventSummary, 'cancelled' | 'officialBody'>
  className?: string
}) {
  if (!cancelled && !officialBody) return null

  return (
    <>
      <span className={cn('flex flex-wrap gap-1.5', className)}>
        {cancelled && <CancelledBadge />}
        {cancelled && officialBody && (
          // The space sits outside the hidden comma: accessible names trim each element's text
          <>
            <span className="sr-only">,</span>{' '}
          </>
        )}
        {officialBody && <OfficialMeetingBadge />}
      </span>
      <span className="sr-only">:</span>{' '}
    </>
  )
}
