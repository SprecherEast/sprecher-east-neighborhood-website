import type { Decorator } from '@storybook/nextjs-vite'
import { useEffect, type ReactNode } from 'react'

import { ThemeProvider, useTheme } from '@/platform/theme/ThemeProvider.client'
import { ACTIVE_THEME } from '@/platform/theme/registry'
import type { Theme } from '@/platform/theme/theme'

// Every theme's token values, by folder name. The active theme's file is already part of the site's
// stylesheet (globals.css); any other is laid over it while it is picked.
const THEME_CSS = import.meta.glob<string>('../src/themes/*/theme.css', {
  query: '?inline',
  import: 'default',
  eager: true,
})

const THEME_CSS_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(THEME_CSS).map(([file, css]) => [file.split('/').at(-2) ?? file, css]),
)

/** Sets light or dark through the site's own `setTheme`, and lays a non-active theme's tokens over the page */
export function SiteTheme({
  name,
  mode,
  themes = THEME_CSS_BY_NAME,
  children,
}: {
  name: string
  mode: Theme
  /** Each theme's token CSS by name; the showcase passes the `theme.css` of every theme folder */
  themes?: Record<string, string>
  children: ReactNode
}) {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme(mode)
  }, [mode, setTheme])

  useEffect(() => {
    const css = name === ACTIVE_THEME ? undefined : themes[name]
    if (!css) return
    const style = document.createElement('style')
    style.dataset.showcaseTheme = name
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, [name, themes])

  return children
}

export const withSiteTheme: Decorator = (Story, { globals }) => (
  <ThemeProvider>
    <SiteTheme name={globals.siteTheme ?? ACTIVE_THEME} mode={globals.mode ?? 'light'}>
      <Story />
    </SiteTheme>
  </ThemeProvider>
)
