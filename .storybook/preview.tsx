import type { Preview } from '@storybook/nextjs-vite'
import { Poppins } from 'next/font/google'

import '../src/app/(frontend)/globals.css'
import { ACTIVE_THEME } from '@/platform/theme/registry'

import { withSiteTheme } from './ThemeDecorator'
import { MODES, siteGlobalTypes } from './themes'
import { VIEWPORTS, viewportOptions } from './viewports'

// The site's body font, set up as app/(frontend)/layout.tsx does, so text is drawn in Poppins
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
  display: 'swap',
})
document.documentElement.classList.add(poppins.variable)

const preview: Preview = {
  globalTypes: siteGlobalTypes,
  initialGlobals: { siteTheme: ACTIVE_THEME, mode: MODES[0] },
  decorators: [withSiteTheme],
  parameters: {
    layout: 'padded',
    viewport: { options: viewportOptions(VIEWPORTS) },
    controls: { expanded: true },
  },
}

export default preview
