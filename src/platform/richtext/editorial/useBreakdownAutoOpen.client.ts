'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { holdScrollAnchor, prefersReducedMotion } from '@/platform/ui/motion.client'
import { TOTAL_PULSE_SHOWN_MS } from '@/platform/ui/ShareBill'

/**
 * How long after the total's flash has faded from sight the City's breakdown opens by itself, the
 * first time a reader estimates their own home (#1163): short enough that the reader has not yet
 * reacted to the new total (#1170, #1174)
 */
export const OPEN_AFTER_TOTAL_MS = 100

/**
 * The City's breakdown row under the whole bill (#1163, #1165). It starts closed and opens by
 * itself once: after the reader's first estimate that changes the bill, when that bill has counted
 * and its total has flashed (`pulse` moves), plus a pause; another bill settling first (a year
 * switch) starts the wait over, and a year switch alone never opens it. Once opened, by itself or by
 * the reader, it never opens by itself again, so a reader who closes it keeps it closed.
 *
 * `openings` counts each opening, by hand or by itself, so the breakdown's bars fill again; it moves
 * before the row opens (from the summary's click, `onOpening`, or here before `open` is set), so the
 * first frame shown is already the start of the fill. Setting `open` scrolls nothing.
 */
export function useBreakdownAutoOpen(pulse: number) {
  const rowRef = useRef<HTMLDetailsElement>(null)
  const [openings, setOpenings] = useState(0)
  const armed = useRef(false)
  const openedOnce = useRef(false)

  const onOpening = useCallback(() => {
    openedOnce.current = true
    // Drawn now, while the row is still closed, so nothing it holds changes once it shows. `flushSync`
    // belongs in this click handler and the timer below, never in an effect body or a render
    flushSync(() => setOpenings((count) => count + 1))
  }, [])

  /** An estimate was asked for; `changesBill` says whether it moves the bill (and so a pulse follows) */
  const arm = useCallback((changesBill: boolean) => {
    if (changesBill && !openedOnce.current) armed.current = true
  }, [])

  useEffect(() => {
    if (pulse === 0 || !armed.current) return
    const flash = prefersReducedMotion() ? 0 : TOTAL_PULSE_SHOWN_MS
    const timer = setTimeout(() => {
      armed.current = false
      const row = rowRef.current
      if (!row) return
      openedOnce.current = true
      if (row.open) return
      flushSync(() => setOpenings((count) => count + 1))
      if (!prefersReducedMotion()) holdScrollAnchor()
      row.open = true
    }, flash + OPEN_AFTER_TOTAL_MS)
    return () => clearTimeout(timer)
  }, [pulse])

  return { rowRef, openings, onOpening, arm }
}
