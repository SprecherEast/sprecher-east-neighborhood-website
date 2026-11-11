'use client'

import { useEffect, useState } from 'react'

import { prefersReducedMotion } from './motion.client'

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * A number that counts to its target when the target changes (#1048): from where it is now, in
 * whole numbers, easing out over `durationMs`, ending exactly on the target. It starts at the
 * target, so nothing counts on the first paint, and it jumps straight to a new target for a reader
 * who asked for less motion.
 */
export function useCountedNumber(target: number, { durationMs = 450 } = {}): number {
  const [state, setState] = useState({ target, from: target, shown: target })
  if (state.target !== target) {
    // Adjusting state while rendering: a new target starts a count from what is shown now
    setState({
      target,
      from: prefersReducedMotion() ? target : state.shown,
      shown: prefersReducedMotion() ? target : state.shown,
    })
  }
  const { from } = state

  useEffect(() => {
    if (from === target) return
    let start: number | null = null
    let frame = 0
    const tick = (time: number) => {
      start ??= time
      const progress = Math.min((time - start) / durationMs, 1)
      setState({ target, from, shown: Math.round(from + (target - from) * easeOut(progress)) })
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, from, durationMs])

  return state.shown
}
