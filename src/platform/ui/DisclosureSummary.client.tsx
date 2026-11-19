'use client'

import React from 'react'

import { holdScrollAnchor } from './motion.client'
import { expansionMs, revealAfterExpansion } from './reveal.client'

export type DisclosureSummaryProps = {
  className?: string
  children: React.ReactNode
  /** Called on a click that is about to open the box, before it opens (#1165) */
  onOpening?: () => void
}

/*
 * The summary row of a `Disclosure` that sits in the page, and its only client code (#1152). When a reader opens the box,
 * the page scrolls just far enough to show its end; a box taller than the screen stops with this
 * row at the top instead, and a box already in view moves nothing, or, when the box names an anchor,
 * with the anchor kept under the sticky header (`reveal.client.ts`, #1178). Closing never scrolls,
 * and neither does a box that is open when the page loads: only a click asks.
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
      if (details.open) revealAfterExpansion(details)
    })
  }

  return (
    <summary className={className} onClick={revealWhenOpened}>
      {children}
    </summary>
  )
}
