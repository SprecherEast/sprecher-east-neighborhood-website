import { Check, CircleDashed, HelpCircle } from 'lucide-react'
import React from 'react'

import { CERTAINTY_LABELS, type Certainty } from '@/platform/lib/certainty'

import { Badge, type BadgeProps } from './Badge'

const BADGE: Record<Certainty, { variant: BadgeProps['variant']; Icon: typeof Check }> = {
  confirmed: { variant: 'category', Icon: Check },
  estimate: { variant: 'caution', Icon: CircleDashed },
  unknown: { variant: 'neutral', Icon: HelpCircle },
}

/**
 * How sure we are, in words and an icon (#509), so the colour is never the only cue. The key
 * facts block and a chart's caption (#639) show it the same way.
 */
export function CertaintyBadge({
  certainty,
  label,
  size,
}: {
  certainty: Certainty
  /** Words of its own in place of the certainty's, such as a year's stored note; the look stays */
  label?: string
  size?: BadgeProps['size']
}) {
  const { variant, Icon } = BADGE[certainty]
  return (
    <Badge variant={variant} size={size}>
      <Icon aria-hidden="true" />
      {label ?? CERTAINTY_LABELS[certainty]}
    </Badge>
  )
}
