'use client'

import { X } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { isBannerExpired } from '@/platform/lib/bannerExpiry'
import { isBannerDismissed, rememberBannerDismissed } from '@/platform/lib/dismissedBanners'

import { Button } from './Button'

// Checks the end time while the page is open, and again when it is shown from a cached copy
const RECHECK_MS = 30_000

export interface DismissibleProps {
  /** Identifies the notice, so a closed one stays closed on this browser */
  id: string
  /** The notice stops showing at this moment (an ISO date and time) */
  showUntil?: string | null
  closeLabel?: string
  children: React.ReactNode
}

/*
 * A notice the visitor can close, once (#814). The server renders it, so it shows without
 * scripting and the cached page needs no cookie; a visitor who closed it earlier sees it
 * collapse as the page loads, before it is painted.
 */
export function Dismissible({
  id,
  showUntil,
  closeLabel = 'Close this notice',
  children,
}: DismissibleProps) {
  const [hidden, setHidden] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (isBannerDismissed(id) || isBannerExpired(showUntil, new Date())) setHidden(true)
  }, [id, showUntil])

  useEffect(() => {
    if (!showUntil) return
    const timer = setInterval(() => {
      if (isBannerExpired(showUntil, new Date())) setHidden(true)
    }, RECHECK_MS)
    return () => clearInterval(timer)
  }, [showUntil])

  if (hidden) return null

  const close = () => {
    // The wrapper is about to leave the page: send focus to the content after it
    const next = ref.current?.nextElementSibling
    if (next instanceof HTMLElement) {
      if (!next.hasAttribute('tabindex')) next.setAttribute('tabindex', '-1')
      next.focus()
    }
    rememberBannerDismissed(id)
    setHidden(true)
  }

  return (
    <div ref={ref} className="relative">
      {children}
      <Button
        variant="ghost"
        size="icon"
        aria-label={closeLabel}
        onClick={close}
        className="absolute top-1 right-1"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
