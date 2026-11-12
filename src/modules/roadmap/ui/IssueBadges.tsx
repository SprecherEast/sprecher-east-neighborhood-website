import { Ban, CircleCheck, CircleDot } from 'lucide-react'
import React from 'react'

import { Badge, BadgeList } from '@/platform/ui/Badge'

import type { PlanIssueState } from '../domain/types'

const STATE_WORDS: Record<PlanIssueState, string> = {
  open: 'Open',
  done: 'Done',
  'not-planned': 'Not planned',
}

const STATE_LOOK = {
  open: { variant: 'open', Icon: CircleDot },
  done: { variant: 'done', Icon: CircleCheck },
  'not-planned': { variant: 'neutral', Icon: Ban },
} as const

/** An issue's state: its words and an icon in a colour of its own, so colour is never the only signal */
export function StateBadge({ state, size = 'md' }: { state: PlanIssueState; size?: 'sm' | 'md' }) {
  const { variant, Icon } = STATE_LOOK[state]
  return (
    <Badge variant={variant} size={size}>
      <Icon aria-hidden="true" />
      {STATE_WORDS[state]}
    </Badge>
  )
}

/** An issue's labels as small badges, leaving out the `epic` label every epic has */
export function LabelBadges({ labels }: { labels: string[] }) {
  const shown = labels.filter((label) => label !== 'epic')
  if (shown.length === 0) return null
  return (
    <BadgeList>
      {shown.map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))}
    </BadgeList>
  )
}
