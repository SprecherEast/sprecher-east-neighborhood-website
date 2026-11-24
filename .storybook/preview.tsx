import type { Preview } from '@storybook/nextjs-vite'

import '../src/app/(frontend)/globals.css'
import { THEME_MODES } from '@/platform/theme/theme'
import { poppins } from '@/platform/theme/fonts'
import { ACTIVE_THEME } from '@/platform/theme/registry'

import { withSiteTheme } from './ThemeDecorator'
import { siteGlobalTypes } from './themes'
import { VIEWPORTS, viewportOptions } from './viewports'

// The site's body font, as the root layout sets it, so text is drawn in Poppins
document.documentElement.classList.add(poppins.variable)

const preview: Preview = {
  globalTypes: siteGlobalTypes,
  initialGlobals: { siteTheme: ACTIVE_THEME, mode: THEME_MODES[0] },
  decorators: [withSiteTheme],
  parameters: {
    layout: 'padded',
    // Every surface comes from the theme: no extra background to pick
    backgrounds: { disable: true },
    viewport: { options: viewportOptions(VIEWPORTS) },
    controls: { expanded: true },
  },
}

export default preview
