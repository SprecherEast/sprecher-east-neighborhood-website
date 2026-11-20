import { CircleX } from 'lucide-react'
import React from 'react'

import { Badge } from './Badge'

/**
 * The "Cancelled" label of a cancelled event (#122), wherever the event shows. The word says it,
 * so screen readers read it with the title and colour is never the only signal.
 */
export function CancelledBadge({ className }: { className?: string }) {
  return (
    <Badge variant="status" className={className}>
      <CircleX aria-hidden="true" />
      Cancelled
    </Badge>
  )
}
