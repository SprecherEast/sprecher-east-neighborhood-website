'use client'

import { useEffect } from 'react'

import { startLikelyHumanClicks } from './likelyHumanClicks'

/** Draws nothing: listens for the clicks `likelyHumanClicks.ts` counts, while it is on the page (#975) */
export function LikelyHumanClicks() {
  useEffect(() => startLikelyHumanClicks(document, window), [])
  return null
}
