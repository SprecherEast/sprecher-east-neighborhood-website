'use client'

import { useEffect, useState } from 'react'

import { easeOut, prefersReducedMotion } from './motion.client'

/** How long a fill takes when it replays: the bars' `chart-fill-x` in the theme, which a test holds to it */
export const FILL_MS = 1000

/**
 * The progress of a fill, from 0 to 1, that replays each time `run` changes (#1163): a row that
 * opens grows its bars and counts its amounts up from nothing with it. It starts at 1, so the first
 * paint and a page without scripting show the final figures, and it stays at 1 for a reader who asked
 * for less motion.
 */
export function useReplayProgress(run: number, durationMs = FILL_MS): number {
  const [state, setState] = useState({ run, progress: 1 })
  if (state.run !== run) {
    // Adjusting state while rendering: a new run starts from nothing, unless motion is reduced
    setState({ run, progress: prefersReducedMotion() ? 1 : 0 })
  }
  const replaying = state.run === run && state.progress < 1

  useEffect(() => {
    if (!replaying) return
    let start: number | null = null
    let frame = 0
    const tick = (time: number) => {
      start ??= time
      const elapsed = Math.min((time - start) / durationMs, 1)
      setState({ run, progress: elapsed >= 1 ? 1 : easeOut(elapsed) })
      if (elapsed < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // Starts once per run: the ticks themselves change progress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, durationMs])

  return state.run === run ? state.progress : prefersReducedMotion() ? 1 : 0
}
