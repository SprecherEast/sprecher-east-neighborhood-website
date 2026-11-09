import { Check } from 'lucide-react'
import React from 'react'

import { Badge, BadgeList } from '@/platform/ui/Badge'

import type { PlanIssueState } from '../domain/types'

const STATE_WORDS: Record<PlanIssueState, string> = {
  open: 'Open',
  done: 'Done',
  'not-planned': 'Not planned',
}

/** An issue's state in words, with a check for done, so colour is never the only signal */
export function StateBadge({ state }: { state: PlanIssueState }) {
  return (
    <Badge variant={state === 'done' ? 'category' : 'neutral'}>
      {state === 'done' && <Check aria-hidden="true" />}
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
        <Badge key={label} variant="neutral">
          {label}
        </Badge>
      ))}
    </BadgeList>
  )
}
