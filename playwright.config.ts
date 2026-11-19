import { defineConfig, devices } from '@playwright/test'

import { E2E } from './e2e/support/settings.mjs'

/**
 * End-to-end tests (#311): each account and contact flow, as a resident uses it, on a phone and
 * a desktop, against a production build with a fresh database (e2e/serve.mjs). One worker: the
 * flows share one server, its site-wide form limits and one mailbox.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: E2E.baseURL,
    timeout: 15 * 60_000,
    // Always a fresh server: its form limits count in memory, so a reused one carries the last
    // run's counts
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
