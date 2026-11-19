import type { Decoration } from './options'
import { getThemeOptions } from './registry'

/** How each decoration is drawn: classes from `decorations.css`, all purely visual. */
const DECORATION_CLASS: Record<Decoration, string> = {
  snowfall: 'theme-decoration-snowfall',
}

/**
 * The page's decoration slot (#409): the active theme's decorative layer, or nothing. It is
 * hidden from assistive technology, takes no clicks, stops moving within 5 seconds and stands
 * still with reduced motion.
 * `decoration` overrides the active theme's, for tests and previews.
 */
export function ThemeDecoration({ decoration }: { decoration?: Decoration | null }) {
  const shown = decoration === undefined ? getThemeOptions().decoration : decoration
  if (!shown) return null
  return (
    <div
      aria-hidden="true"
      data-decoration={shown}
      className={`pointer-events-none fixed inset-0 z-40 ${DECORATION_CLASS[shown]}`}
    />
  )
}
