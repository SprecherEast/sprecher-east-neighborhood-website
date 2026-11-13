'use client'

import React from 'react'

import { REVEAL_PEEK_VAR } from './scrollMargin'

export type DisclosureSummaryProps = {
  className?: string
  children: React.ReactNode
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
// How much of what follows the next summary row also shows, as a share of that row's height
const PAST_NEXT_ROW = 0.5

/** The room to keep under an open box: none unless another box sits directly under it */
function roomForNext(details: HTMLDetailsElement): number {
  const next = details.nextElementSibling
  const row = next instanceof HTMLDetailsElement ? next.querySelector(':scope > summary') : null
  if (!row) return 0
  const { bottom, height } = row.getBoundingClientRect()
  return Math.round(bottom - details.getBoundingClientRect().bottom + height * PAST_NEXT_ROW)
}

export function DisclosureSummary({ className, children }: DisclosureSummaryProps) {
  const revealWhenOpened = (event: React.MouseEvent<HTMLElement>) => {
    const details = event.currentTarget.parentElement
    if (!(details instanceof HTMLDetailsElement) || details.open) return
    // The box opens after this click is handled, so its new height is there on the next frame
    requestAnimationFrame(() => {
      if (!details.open) return
      const room = roomForNext(details)
      if (room > 0) details.style.setProperty(REVEAL_PEEK_VAR, `${room}px`)
      else details.style.removeProperty(REVEAL_PEEK_VAR)
      details.scrollIntoView({ block: 'nearest' })
    })
  }

  return (
    <summary className={className} onClick={revealWhenOpened}>
      {children}
    </summary>
  )
}
