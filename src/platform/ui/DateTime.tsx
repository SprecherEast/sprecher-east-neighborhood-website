import React from 'react'

import { formatDateShort, formatDateTime, toDateTimeAttr } from '@/platform/lib/formatDateTime'

export type DateTimeProps = {
  /** An ISO timestamp, as Payload stores it */
  value: string
  /** `short`: "Mar 3" (with the year when it isn't this year); `long`: "Tue, Mar 3, 2026" */
  format?: 'short' | 'long'
  className?: string
}

/*
 * A date people read and machines parse (#432). The `dateTime` attribute always comes from
 * `toDateTimeAttr`, so a day-only date is a calendar date, not the instant the evening before; the
 * text is formatted in UTC for day-only dates and in the site's time zone otherwise.
 */
export function DateTime({ value, format = 'short', className }: DateTimeProps) {
  // Bad data shows nothing rather than "Invalid Date" or a thrown error
  if (Number.isNaN(Date.parse(value))) return null

  return (
    <time className={className} dateTime={toDateTimeAttr(value)}>
      {format === 'long' ? formatDateTime(value) : formatDateShort(value)}
    </time>
  )
}
