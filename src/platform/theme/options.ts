/**
 * The theme-options contract (decision 0012 point 4, #409): what a theme can set that tokens
 * can't express. Every option has a default, so a theme that only changes colours needs nothing
 * here. Keep the list short: each option is permanent API that every theme inherits.
 */

/** The decorations a theme can turn on. Each is drawn by `ThemeDecoration`. */
export const DECORATIONS = ['snowfall'] as const
export type Decoration = (typeof DECORATIONS)[number]

export type ThemeOptions = {
  /** A decorative layer over the page (seasonal ornaments); `null` for none. */
  decoration: Decoration | null
}

export const DEFAULT_THEME_OPTIONS: Readonly<ThemeOptions> = { decoration: null }

/** A theme's options with every option it leaves out set to its default. */
export function resolveThemeOptions(options: Partial<ThemeOptions> = {}): ThemeOptions {
  return { ...DEFAULT_THEME_OPTIONS, ...options }
}
