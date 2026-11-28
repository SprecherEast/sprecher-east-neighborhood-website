/** The two modes the site sets as `data-theme` on <html>; the one list everything else reads */
export const THEME_MODES = ['light', 'dark'] as const

export type Theme = (typeof THEME_MODES)[number]

export interface ThemeContextType {
  setTheme: (theme: Theme | null) => void
  theme?: Theme | null
}

export const themeLocalStorageKey = 'payload-theme'

export const defaultTheme = 'light'

export function themeIsValid(string: null | string): string is Theme {
  return string ? (THEME_MODES as readonly string[]).includes(string) : false
}

export const getImplicitPreference = (): Theme | null => {
  const mediaQuery = '(prefers-color-scheme: dark)'
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mql = window.matchMedia(mediaQuery)
    if (mql.matches) return 'dark'
    // If the browser does not prefer dark, treat it as preferring light
    return 'light'
  }
  return null
}
