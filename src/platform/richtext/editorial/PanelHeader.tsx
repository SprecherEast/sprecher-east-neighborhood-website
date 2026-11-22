import React, { type ReactNode } from 'react'

import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'

import type { StatusBadge } from './billShareView'

/** The tab's status badge as the whole-bill panels draw it (#1417): small, a button when it has something to say */
export function StatusBadgeButton({
  badge,
  onPress,
}: {
  badge: StatusBadge
  onPress?: () => void
}) {
  return (
    <CertaintyBadge certainty={badge.certainty} label={badge.label} size="xs" onPress={onPress} />
  )
}

/**
 * The top line of a whole-bill panel (#1417): its title on the left and, when it has one, the status
 * badge at the end of the same line; a panel too narrow for both puts the badge whole on a line of
 * its own under the title. The answer card and the rates panel share it, so they can never differ.
 */
export function PanelHeader({
  badge,
  onBadgePress,
  children,
}: {
  badge?: StatusBadge | null
  onBadgePress?: () => void
  /** The title */
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      {children}
      {badge && (
        <span className="ml-auto shrink-0">
          <StatusBadgeButton badge={badge} onPress={onBadgePress} />
        </span>
      )}
    </div>
  )
}
