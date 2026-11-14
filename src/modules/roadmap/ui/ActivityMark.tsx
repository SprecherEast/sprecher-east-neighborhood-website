import { Circle } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/**
 * Whether anything was finished this week, by shape and in words: a filled dot when something
 * was, a hollow one when it was quiet. The words are for screen readers; the shape differs so
 * colour is never the only signal.
 */
export function ActivityMark({ quiet }: { quiet: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center">
      <Circle
        aria-hidden="true"
        className={cn('size-3', quiet ? 'text-muted-foreground' : 'fill-done text-done')}
      />
      <span className="sr-only">{quiet ? 'Quiet this week' : 'Finished something this week'}</span>
    </span>
  )
}
