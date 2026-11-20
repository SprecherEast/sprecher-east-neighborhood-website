import path from 'node:path'

import { createClient, type Client } from '@libsql/client'

import { currentServer } from './server'

const clients = new Map<string, Client>()

/**
 * The test database of the server the running test talks to (the production build or the passkey
 * one), for the one thing a test can't do through the site: let time pass. A link's expiry is moved
 * into the past, so the test sees what a resident sees a day later.
 */
function db(): Client {
  const { dataDir } = currentServer()
  const known = clients.get(dataDir)
  if (known) return known
  const client = createClient({ url: `file:${path.join(process.cwd(), dataDir, 'e2e.db')}` })
  clients.set(dataDir, client)
  return client
}

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

/** Expires the email-confirmation link sent to an address. */
export async function expireConfirmationLink(email: string) {
  await db().execute({
    sql: 'UPDATE email_confirmations SET token_expires_at = ? WHERE lower(email) = lower(?)',
    args: [yesterday(), email],
  })
}

/** Expires the password-reset link sent to an account. */
export async function expireResetLink(email: string) {
  await db().execute({
    sql: 'UPDATE users SET reset_password_expiration = ? WHERE lower(email) = lower(?)',
    args: [yesterday(), email],
  })
}
