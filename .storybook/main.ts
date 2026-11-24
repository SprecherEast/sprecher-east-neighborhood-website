import type { StorybookConfig } from '@storybook/nextjs-vite'

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
  features: { sidebarOnboardingChecklist: false },
  typescript: { reactDocgen: 'react-docgen-typescript' },
}

export default config
