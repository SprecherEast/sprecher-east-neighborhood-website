import { defineConfig, devices } from '@playwright/test'

import { E2E } from './e2e/support/settings.mjs'

const PHONE = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }

// What the second server walks (#1317): the passkey flows, and the account flows that the passkey
// switch changes (the log in page and the lockout). Its site-wide sign-up
// limit (20 an hour) is why it isn't the whole accounts spec: the passkey tests use 12, the offer's 2, these 4
const PASSKEY_SERVER_TESTS = ['passkeys.spec.ts', 'passkeyOffer.spec.ts', 'accounts.spec.ts']
const PASSKEY_SERVER_ACCOUNT_FLOWS = /passkeys\.spec|passkeyOffer\.spec|accounts\.spec\.ts sign in /

/**
 * End-to-end tests (#311): each account and contact flow, as a resident uses it, on a phone and
 * a desktop, against a production build with a fresh database (e2e/serve.mjs). One worker: the
 * flows share one server, its site-wide form limits and one mailbox. The passkey flows (#1317)
 * run against a second server, `next dev` with the passkey switch on, because the production
 * build on http://localhost can't have it on (decision 0021).
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
    { name: 'phone', use: PHONE, testIgnore: '**/passkey*.spec.ts' },
    { name: 'desktop', use: DESKTOP, testIgnore: '**/passkey*.spec.ts' },
    {
      name: 'passkeys-phone',
      use: { ...PHONE, baseURL: E2E.passkeys.baseURL },
      metadata: { server: 'passkeys' },
      testMatch: PASSKEY_SERVER_TESTS.map((file) => `**/${file}`),
      grep: PASSKEY_SERVER_ACCOUNT_FLOWS,
    },
    {
      name: 'passkeys-desktop',
      use: { ...DESKTOP, baseURL: E2E.passkeys.baseURL },
      metadata: { server: 'passkeys' },
      testMatch: PASSKEY_SERVER_TESTS.map((file) => `**/${file}`),
      grep: PASSKEY_SERVER_ACCOUNT_FLOWS,
    },
  ],
  webServer: [
    {
      command: 'node e2e/serve.mjs',
      url: E2E.baseURL,
      timeout: 15 * 60_000,
      // Always a fresh server: its form limits count in memory, so a reused one carries the last
      // run's counts
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'node e2e/serve.mjs passkeys',
      // The log in page, so the first compile happens before the tests start
      url: `${E2E.passkeys.baseURL}/login`,
      timeout: 15 * 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
