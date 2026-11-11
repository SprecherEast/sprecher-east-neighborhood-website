/** Browser-only helpers for movement a reader can turn off in their system settings (#1048) */

/**
 * Whether the reader asked for less motion. A browser that cannot say counts as asking, so nothing
 * moves where we cannot tell.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** How long the page may take to settle after a smooth scroll starts, whatever the browser does */
const SCROLL_LIMIT_MS = 2000
/** How long a still page may wait for a scroll to begin before it counts as not scrolling */
const SCROLL_START_MS = 150
/** How long the page has to stay still to count as the scroll having stopped */
const STILL_MS = 100

const isInView = (element: Element) => {
  const { top, bottom } = element.getBoundingClientRect()
  return top >= 0 && bottom <= window.innerHeight
}

/**
 * Scrolls smoothly, by the least distance, to bring an element fully on screen, and resolves once
 * the page has stopped moving. It does nothing, and resolves at once, when the element is already
 * fully on screen or the reader asked for less motion (the page then just shows the new numbers).
 * A browser's own scroll speed decides how long it takes, so the end is found by watching the page
 * hold still rather than by a timer (`scrollend` is not in every browser).
 */
export function scrollToUnlessVisible(element: Element): Promise<void> {
  if (prefersReducedMotion() || isInView(element)) return Promise.resolve()
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  return new Promise((resolve) => {
    const started = Date.now()
    let last = window.scrollY
    let movedAt = started
    let moved = false
    const timer = setInterval(() => {
      const now = Date.now()
      if (window.scrollY !== last) {
        last = window.scrollY
        movedAt = now
        moved = true
      }
      const still = now - movedAt
      const done = moved ? still >= STILL_MS : now - started >= SCROLL_START_MS
      if (done || now - started >= SCROLL_LIMIT_MS) {
        clearInterval(timer)
        resolve()
      }
    }, 16)
  })
}
