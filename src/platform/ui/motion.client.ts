/** Browser-only helpers for movement a reader can turn off in their system settings (#1048) */

/**
 * Whether the reader asked for less motion. A browser that cannot say counts as asking, so nothing
 * moves where we cannot tell.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
