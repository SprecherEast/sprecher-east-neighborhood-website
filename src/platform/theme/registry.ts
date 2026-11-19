import { resolveThemeOptions, type ThemeOptions } from './options'

/**
 * Every theme and the options it sets (#409). Each name has a folder in `src/themes/<name>/`
 * holding its token values (`theme.css`); `registry.test.ts` checks the two lists match.
 * A theme that sets no options is `{}`.
 */
export const THEMES = {
  default: {},
} as const satisfies Record<string, Partial<ThemeOptions>>

export type ThemeName = keyof typeof THEMES

/**
 * The theme the site shows. Fixed per build until runtime switching (decision 0012, #370);
 * `src/app/(frontend)/globals.css` imports the same theme's `theme.css`.
 */
export const ACTIVE_THEME: ThemeName = 'default'

/** The options of a theme, with defaults filled in. */
export const getThemeOptions = (name: ThemeName = ACTIVE_THEME): ThemeOptions =>
  resolveThemeOptions(THEMES[name])
