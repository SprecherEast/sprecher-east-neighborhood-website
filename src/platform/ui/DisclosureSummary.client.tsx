'use client'

import React from 'react'

import { holdScrollAnchor } from './motion.client'
import { REVEAL_PEEK_VAR } from './scrollMargin'

export type DisclosureSummaryProps = {
  className?: string
  children: React.ReactNode
  /** Called on a click that is about to open the box, before it opens (#1165) */
  onOpening?: () => void
}

// How much of what follows the next summary row also shows, as a share of that row's height
const PAST_NEXT_ROW = 0.5

/** How long the box takes to expand, from its own style (`disclosure-expand`); 0 when it opens at once */
function expansionMs(details: HTMLDetailsElement): number {
  try {
    const duration = getComputedStyle(details, '::details-content').transitionDuration
    const first = parseFloat(duration)
    if (!Number.isFinite(first)) return 0
    return Math.round(first * (duration.trim().split(',')[0]?.endsWith('ms') ? 1 : 1000))
  } catch {
    return 0
  }
}

/** The room to keep under an open box: none unless another box sits directly under it */
function roomForNext(details: HTMLDetailsElement): number {
  const next = details.nextElementSibling
  const row = next instanceof HTMLDetailsElement ? next.querySelector(':scope > summary') : null
  if (!row) return 0
  const { bottom, height } = row.getBoundingClientRect()
  return Math.round(bottom - details.getBoundingClientRect().bottom + height * PAST_NEXT_ROW)
}

/*
 * The summary row of a `Disclosure` that sits in the page, and its only client code (#1152). When a reader opens the box,
 * the page scrolls just far enough to show its end; a box taller than the screen stops with this
 * row at the top instead, and a box already in view moves nothing. The browser does all three
 * (`block: 'nearest'`), measuring from the box's scroll margins (`REVEAL_SCROLL_MARGIN`). Closing
 * never scrolls, and neither does a box that is open when the page loads: only a click asks.
 *
 * A box with another directly under it keeps room for that one's summary row and a little more
 * (#1154), so the reader sees there is more to open. The room is added to the box's own bottom
 * scroll margin, so the same browser rule applies and this row still wins when not all of it fits.
 */
export function DisclosureSummary({ className, children, onOpening }: DisclosureSummaryProps) {
  const revealWhenOpened = (event: React.MouseEvent<HTMLElement>) => {
    const details = event.currentTarget.parentElement
    if (!(details instanceof HTMLDetailsElement)) return
    // Folding or expanding takes a moment: the page must not scroll with it (#1170)
    const wait = expansionMs(details)
    if (wait > 0) holdScrollAnchor(wait)
    if (details.open) return
    // The box is still closed here: the caller's update lands before it opens and paints
    onOpening?.()
    // The box opens after this click is handled, so its new height is there on the next frame, or
    // when its expansion ends (#1170), so the page scrolls to the box's full height
    requestAnimationFrame(() => {
      if (!details.open) return
      const reveal = () => {
        if (!details.open) return
        const room = roomForNext(details)
        if (room > 0) details.style.setProperty(REVEAL_PEEK_VAR, `${room}px`)
        else details.style.removeProperty(REVEAL_PEEK_VAR)
        details.scrollIntoView({ block: 'nearest' })
      }
      if (wait > 0) setTimeout(reveal, wait)
      else reveal()
    })
  }

  return (
    <summary className={className} onClick={revealWhenOpened}>
      {children}
    </summary>
  )
}
