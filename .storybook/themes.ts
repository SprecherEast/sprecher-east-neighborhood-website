// The showcase's theme switch. Which themes exist comes from the site's theme registry, and the
// modes are the two values the site sets as `data-theme` on <html> (src/platform/theme), so nothing
// here lists a theme by hand. themes.test.ts checks both against the site.
import type { GlobalTypes } from 'storybook/internal/types'

import { THEMES } from '@/platform/theme/registry'
import { THEME_MODES } from '@/platform/theme/theme'

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
      items: THEME_MODES.map((value) => ({ value, title: value === 'dark' ? 'Dark' : 'Light' })),
      dynamicTitle: true,
    },
  },
} satisfies GlobalTypes
