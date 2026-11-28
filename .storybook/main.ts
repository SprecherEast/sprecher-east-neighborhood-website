import type { StorybookConfig } from '@storybook/nextjs-vite'
import { mergeConfig } from 'vite'

import { neverInlineFonts } from './inlineLimit'

/**
 * The component showcase (#1424): every story sits beside its component. `react-docgen-typescript`
 * reads each component's real props, so the controls offer the variants the code declares.
 */
const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  // No telemetry, release notices or onboarding checklist in a project's own showcase
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  // The site's font faces are files in the build, never data URLs (see inlineLimit.ts)
  viteFinal: (config) => mergeConfig(config, { build: { assetsInlineLimit: neverInlineFonts } }),
  features: { sidebarOnboardingChecklist: false },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    // Props that come from a library (`next/link`'s, the DOM's) are not the kit's own settings
    reactDocgenTypescriptOptions: {
      docgenMode: 'legacy',
      // The setup files are not components of the kit
      exclude: ['**/node_modules/**', '**/.storybook/**'],
      // Storybook's own defaults, which this object replaces: literal unions become select controls
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => {
        const files = [prop.parent, ...(prop.declarations ?? [])].flatMap((place) =>
          place ? [place.fileName] : [],
        )
        return !files.length || !files.every((file) => file.includes('node_modules'))
      },
    },
  },
}

export default config
