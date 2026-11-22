import React, { type ReactNode } from 'react'

import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { PANEL_TITLE_ASIDE, PANEL_TITLE_ROW } from '@/platform/ui/ShareBill'

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

/** An unseen copy of a badge, keeping its room while the year has none, so the panel keeps its height (#1417) */
export function BadgeRoom({ badge }: { badge: StatusBadge }) {
  return (
    <span aria-hidden className={`${PANEL_TITLE_ASIDE} invisible`}>
      <StatusBadgeButton badge={badge} />
    </span>
  )
}

/**
 * The top line of a whole-bill panel (#1417): its title on the left and, when it has one, the status
 * badge at the end of the same line, level with the title's first line; a title too long to share
 * the line puts the badge under it, at its start. The answer card, the rates panel and the
 * whole bill share the line (`PANEL_TITLE_ROW`), so they can never differ.
 */
export function PanelHeader({
  badge,
  room,
  onBadgePress,
  children,
}: {
  badge?: StatusBadge | null
  /** A badge the panel will have in another year: while there is none, its room is kept so the panel keeps its height */
  room?: StatusBadge | null
  onBadgePress?: () => void
  /** The title */
  children: ReactNode
}) {
  return (
    <div className={PANEL_TITLE_ROW}>
      {children}
      {badge && (
        <span className={PANEL_TITLE_ASIDE}>
          <StatusBadgeButton badge={badge} onPress={onBadgePress} />
        </span>
      )}
      {!badge && room && <BadgeRoom badge={room} />}
    </div>
  )
}
