import { CircleX } from 'lucide-react'
import React from 'react'

import { Badge } from './Badge'

/**
 * The "Cancelled" label of a cancelled event (#122), wherever the event shows. The word says it,
 * so screen readers read it with the title and colour is never the only signal. `on-image` is
 * the label on the event's photo, on its own scrim.
 */
export function CancelledBadge({
  variant = 'status',
  className,
}: {
  variant?: 'status' | 'on-image'
  className?: string
}) {
  return (
    <Badge variant={variant} className={className}>
      <CircleX aria-hidden="true" />
      Cancelled
    </Badge>
  )
}
