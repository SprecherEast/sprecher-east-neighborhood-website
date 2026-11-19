import { Landmark } from 'lucide-react'
import React from 'react'

import { Badge } from '@/platform/ui/Badge'

/**
 * The "Official meeting" label of a public body's own meeting (#122), wherever the event shows.
 * The words say it, so colour is never the only signal; the icon is decoration. The event page
 * names the body instead ("City of Madison meeting"). `on-image` is the label on the event's
 * photo, on its own scrim.
 */
export function OfficialMeetingBadge({
  children = 'Official meeting',
  variant = 'official',
  className,
}: {
  children?: React.ReactNode
  variant?: 'official' | 'on-image'
  className?: string
}) {
  return (
    <Badge variant={variant} className={className}>
      <Landmark aria-hidden="true" />
      {children}
    </Badge>
  )
}
