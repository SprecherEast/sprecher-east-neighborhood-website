import { test } from '@playwright/test'

import { E2E } from './settings.mjs'

/** What a test needs to know about the server its project runs against. */
export type E2EServer = { baseURL: string; dataDir: string }

/**
 * The server the running test talks to (#1317): the passkey server for the projects that say
 * `metadata: { server: 'passkeys' }` in `playwright.config.ts`, the production build otherwise.
 * Where each server keeps its mailbox and database follows from it, so the helpers that read
 * them work on either.
 */
export function currentServer(): E2EServer {
  return test.info().project.metadata.server === 'passkeys' ? E2E.passkeys : E2E
}
