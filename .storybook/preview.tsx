import type { Preview } from '@storybook/nextjs-vite'

import '../src/app/(frontend)/globals.css'
import './fonts.css'

import { withSiteTheme } from './ThemeDecorator'
import { initialSiteGlobals, siteGlobalTypes } from './themes'
import { VIEWPORTS, viewportOptions } from './viewports'

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
