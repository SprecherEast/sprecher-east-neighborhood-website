// The showcase's theme switch. Which themes exist comes from the site's theme registry, and the
// modes, their default and the active theme are the site's own (src/platform/theme), so nothing
// here lists a theme or a mode by hand. themes.test.ts checks both against the site.
import type { GlobalTypes } from 'storybook/internal/types'

import { ACTIVE_THEME, THEMES } from '@/platform/theme/registry'
import { THEME_MODES, defaultTheme } from '@/platform/theme/theme'

export const THEME_NAMES = Object.keys(THEMES)

/** The toolbar's two switches: which theme's token values, and light or dark */
export const siteGlobalTypes = {
  siteTheme: {
    name: 'Theme',
    description: 'Which theme the components are drawn in',
    toolbar: { icon: 'paintbrush', items: THEME_NAMES, dynamicTitle: true },
  },
  mode: {
    name: 'Mode',
    description: 'Light or dark mode',
    toolbar: {
      icon: 'circlehollow',
      items: THEME_MODES.map((value) => ({
        value,
        title: value[0].toUpperCase() + value.slice(1),
      })),
      dynamicTitle: true,
    },
  },
} satisfies GlobalTypes

/** What the toolbar starts on: the site's own default mode and its active theme */
export const initialSiteGlobals = { siteTheme: ACTIVE_THEME, mode: defaultTheme }
