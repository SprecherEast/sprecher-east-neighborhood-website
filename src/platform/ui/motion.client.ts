/** Browser-only helpers for movement a reader can turn off in their system settings (#1048) */

/**
 * Whether the reader asked for less motion. A browser that cannot say counts as asking, so nothing
 * moves where we cannot tell.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * How long a row that opens in place takes to expand (#1170): the `disclosure-expand` utility in the
 * theme, which a test holds to it. What fills inside it waits this long, so it starts as the
 * row finishes opening.
 */
export const EXPAND_MS = 500

let releaseAnchor: ReturnType<typeof setTimeout> | undefined

/**
 * Switches the browser's scroll anchoring off for the page while a row expands or folds (#1170): a
 * height that grows over time under a row with other content below it would otherwise scroll the page
 * by the same amount, frame by frame, and carry the row off screen. The theme's rule on
 * `html[data-expanding]` does the switching; it is lifted a moment after the expansion ends.
 */
export function holdScrollAnchor(ms = EXPAND_MS): void {
  const root = document.documentElement
  root.setAttribute('data-expanding', '')
  clearTimeout(releaseAnchor)
  releaseAnchor = setTimeout(() => root.removeAttribute('data-expanding'), ms + 50)
}

/** The ease every count and fill here shares: fast first, settling at the end (CSS: `cubic-bezier(0.33, 1, 0.68, 1)`) */
export const easeOut = (t: number) => 1 - (1 - t) ** 3
