import type { Payload } from 'payload'
import { vi } from 'vitest'

/**
 * Starts Payload for a test on an in-memory SQLite database (no file, no network), as the config
 * the site runs, with email logged instead of sent. The first account on an empty database
 * becomes an admin (#354), so one is made here and returned: accounts a test makes after it are
 * guests.
 */
export async function startPayload(secret: string): Promise<{ payload: Payload; firstId: number }> {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', secret)
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await (await import('@payload-config')).default })
  const first = await payload.create({
    collection: 'users',
    data: { email: 'first@example.com', password: 'first-account-password', role: 'guest' },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  return { payload, firstId: first.id }
}
