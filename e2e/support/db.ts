import path from 'node:path'

import { createClient } from '@libsql/client'

import { E2E } from './settings.mjs'

/**
 * The test database, for the one thing a test can't do through the site: let time pass. A link's
 * expiry is moved into the past, so the test sees what a resident sees a day later.
 */
const db = createClient({ url: `file:${path.join(process.cwd(), E2E.dataDir, 'e2e.db')}` })

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

/** Expires the email-confirmation link sent to an address. */
export async function expireConfirmationLink(email: string) {
  await db.execute({
    sql: 'UPDATE email_confirmations SET token_expires_at = ? WHERE lower(email) = lower(?)',
    args: [yesterday(), email],
  })
}

/** Expires the password-reset link sent to an account. */
export async function expireResetLink(email: string) {
  await db.execute({
    sql: 'UPDATE users SET reset_password_expiration = ? WHERE lower(email) = lower(?)',
    args: [yesterday(), email],
  })
}
