import type { Preview } from '@storybook/nextjs-vite'

import '../src/app/(frontend)/globals.css'
import { poppins } from '@/platform/theme/fonts'

import { withSiteTheme } from './ThemeDecorator'
import { initialSiteGlobals, siteGlobalTypes } from './themes'
import { VIEWPORTS, viewportOptions } from './viewports'

// The site's body font, as the root layout sets it, so text is drawn in Poppins
document.documentElement.classList.add(poppins.variable)

const preview: Preview = {
  globalTypes: siteGlobalTypes,
  initialGlobals: initialSiteGlobals,
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
