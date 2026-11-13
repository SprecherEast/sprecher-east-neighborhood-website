'use client'

import React from 'react'

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
 */
export function DisclosureSummary({ className, children }: DisclosureSummaryProps) {
  const revealWhenOpened = (event: React.MouseEvent<HTMLElement>) => {
    const details = event.currentTarget.parentElement
    if (!(details instanceof HTMLDetailsElement) || details.open) return
    // The box opens after this click is handled, so its new height is there on the next frame
    requestAnimationFrame(() => {
      if (details.open) details.scrollIntoView({ block: 'nearest' })
    })
  }

  return (
    <summary className={className} onClick={revealWhenOpened}>
      {children}
    </summary>
  )
}
