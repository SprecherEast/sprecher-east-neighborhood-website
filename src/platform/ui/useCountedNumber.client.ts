'use client'

import { useEffect, useState } from 'react'

import { easeOut, prefersReducedMotion } from './motion.client'

/** Long enough that a reader sees the numbers move (the first, half-second count went unnoticed) */
export const COUNT_MS = 1500
/** A switch of tax year counts faster: the reader only needs to see the amounts move (#1087) */
export const YEAR_COUNT_MS = 500

/**
 * A number that counts to its target when the target changes (#1048): from where it is now, in
 * whole numbers, easing out over `durationMs`, ending exactly on the target. It starts at the
 * target, so nothing counts on the first paint, and it jumps straight to a new target for a reader
 * who asked for less motion.
 */
export function useCountedNumber(target: number, { durationMs = COUNT_MS } = {}): number {
  const [state, setState] = useState({ target, from: target, shown: target, duration: durationMs })
  if (state.target !== target) {
    // Adjusting state while rendering: a new target starts a count from what is shown now, with
    // the duration asked for now; a count that is running keeps its own (#1087)
    setState({
      target,
      duration: durationMs,
      from: prefersReducedMotion() ? target : state.shown,
      shown: prefersReducedMotion() ? target : state.shown,
    })
  }
  const { from, duration } = state

  useEffect(() => {
    if (from === target) return
    let start: number | null = null
    let frame = 0
    const tick = (time: number) => {
      start ??= time
      const progress = Math.min((time - start) / duration, 1)
      setState({
        target,
        from,
        duration,
        shown: Math.round(from + (target - from) * easeOut(progress)),
      })
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, from, duration])

  return state.shown
}
