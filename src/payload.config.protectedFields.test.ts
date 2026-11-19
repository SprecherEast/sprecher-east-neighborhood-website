import { REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Server-only fields refuse writes from the API (#299). `hidden: true` hides a field from reads
 * only, so each one also sets field access (`serverOnlyFieldAccess`); `accessPolicy.test.ts` checks
 * the config. These tests send the writes a visitor or a guest could send, through Payload's
 * REST handlers and the Local API, and check what was stored. Payload runs on an in-memory SQLite
 * database: no file, no network.
 */

let config: SanitizedConfig
let payload: Payload

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'protected-fields-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  config = await (await import('@payload-config')).default
  payload = await getPayload({ config })
}, 60_000)

/** Sends a JSON request to Payload's REST API, as the site's `/api` route does. */
async function rest(
  method: 'POST' | 'PATCH',
  path: string[],
  body: Record<string, unknown>,
  token?: string,
): Promise<Response> {
  const handler = (method === 'POST' ? REST_POST : REST_PATCH)(Promise.resolve(config))
  const request = new Request(`http://localhost:3000/api/${path.join('/')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return handler(request, { params: Promise.resolve({ slug: path }) })
}

const stored = (collection: 'users' | 'email-confirmations' | 'form-submissions', id: number) =>
  payload.findByID({ collection, id, depth: 0, overrideAccess: true, showHiddenFields: true })

// What a resident might try on their own account: reset the resend limit, or skip choosing a
// password on a resent link (#289)
const FORGED_RESENDS = {
  verificationResends: 99,
  verificationResendsSince: '2020-01-01T00:00:00.000Z',
  verificationSetsPassword: true,
  // Or plant a used-link hash, so a link would read "already confirmed" (#391)
  verifiedTokenHash: 'f'.repeat(64),
}

describe('a guest’s own account', () => {
  let resident: { id: number; token: string }

  beforeAll(async () => {
    const password = 'guest-password-for-tests'
    // The first account on an empty database becomes an admin (#354); it is not the one tested
    await payload.create({
      collection: 'users',
      data: { email: 'first@example.com', password, name: 'First', role: 'guest' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    const user = await payload.create({
      collection: 'users',
      data: { email: 'guest@example.com', password, name: 'Guest', role: 'guest' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    // Verified, as opening the emailed link would, so the account can sign in
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { _verified: true },
      returning: false,
    })
    const { token } = await payload.login({
      collection: 'users',
      data: { email: 'guest@example.com', password },
    })
    resident = { id: user.id, token: token ?? '' }
  })

  it('ignores the verification fields in a REST update', async () => {
    const response = await rest(
      'PATCH',
      ['users', String(resident.id)],
      {
        name: 'Renamed',
        ...FORGED_RESENDS,
      },
      resident.token,
    )
    expect(response.status).toBe(200)
    expect(await stored('users', resident.id)).toMatchObject({
      name: 'Renamed',
      verificationResends: 0,
      verificationResendsSince: null,
      verificationSetsPassword: false,
      verifiedTokenHash: null,
    })
  })

  it('ignores them in a Local API update made as the resident', async () => {
    const user = await stored('users', resident.id)
    await payload.update({
      collection: 'users',
      id: resident.id,
      data: FORGED_RESENDS,
      user,
      overrideAccess: false,
    })
    expect(await stored('users', resident.id)).toMatchObject({
      verificationResends: 0,
      verificationResendsSince: null,
      verificationSetsPassword: false,
      verifiedTokenHash: null,
    })
  })
})

describe('email confirmations', () => {
  const forged = { email: 'visitor@example.com', tokenHash: 'a'.repeat(64), sendCount: 0 }

  it('refuse a visitor’s REST create', async () => {
    const response = await rest('POST', ['email-confirmations'], forged)
    expect(response.status).toBe(403)
  })

  it('refuse a visitor’s Local API create', async () => {
    await expect(
      payload.create({ collection: 'email-confirmations', data: forged, overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('ignore the token and the send limit even in an admin’s update', async () => {
    const record = await payload.create({
      collection: 'email-confirmations',
      data: { email: 'ana@example.com', tokenHash: 'b'.repeat(64), sendCount: 1 },
      overrideAccess: true,
    })
    const admin = await payload.create({
      collection: 'users',
      data: { email: 'admin@example.com', password: 'admin-password-for-tests', role: 'admin' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'email-confirmations',
      id: record.id,
      data: { tokenHash: forged.tokenHash, sendCount: 0 },
      user: { ...admin, collection: 'users' },
      overrideAccess: false,
    })
    expect(await stored('email-confirmations', record.id)).toMatchObject({
      tokenHash: 'b'.repeat(64),
      sendCount: 1,
    })
  })
})

describe('a contact message', () => {
  it('ignores held emails and a confirmed flag a visitor sends over REST', async () => {
    const form = await payload.create({
      collection: 'forms',
      data: {
        title: 'Contact',
        confirmationType: 'redirect',
        redirect: { url: '/thanks' },
        fields: [{ blockType: 'email', name: 'email', label: 'Email', required: true }],
      },
      overrideAccess: true,
    })
    const response = await rest('POST', ['form-submissions'], {
      form: form.id,
      submissionData: [{ field: 'email', value: 'sender@example.com' }],
      heldEmails: [{ to: 'someone@example.com', subject: 'Forged', html: 'Forged' }],
      emailConfirmed: true,
    })
    expect(response.status).toBe(201)
    const { doc } = (await response.json()) as { doc: { id: number } }
    const submission = await stored('form-submissions', doc.id)
    expect(submission).toMatchObject({ emailConfirmed: false })
    expect('heldEmails' in submission ? submission.heldEmails : null).toBeNull()
  })
})
