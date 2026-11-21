import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { PREVIEW_ADMIN_EMAIL, seedPreviewDatabase } from './preview-database'

/**
 * A pull request preview's first database holds one admin account nobody can sign in to (#1075): the
 * first account on an empty `users` collection becomes an admin (#354), so a reachable preview must
 * never have it empty. Payload runs on in-memory SQLite: no file, no network.
 */

let payload: Payload
const PREVIEW = { PREVIEW_NUMBER: '7' }

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'preview-database-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
}, 60_000)

const accounts = () =>
  payload.find({
    collection: 'users',
    depth: 0,
    limit: 10,
    overrideAccess: true,
    showHiddenFields: true,
  })

describe('seedPreviewDatabase', () => {
  it.each([{}, { PREVIEW_NUMBER: '' }])(
    'refuses to run without a pull request number (a hand run against production), and makes nothing (%j)',
    async (env) => {
      await expect(seedPreviewDatabase(payload, env)).rejects.toThrow('only for a pull request')
      expect((await accounts()).totalDocs).toBe(0)
    },
  )

  it('makes one admin account on an empty database, and only once', async () => {
    expect((await accounts()).totalDocs).toBe(0)
    const send = vi.spyOn(payload.email, 'sendEmail') // Payload's verification mail goes through this one
    expect(await seedPreviewDatabase(payload, PREVIEW)).toBe('seeded')
    expect(send).not.toHaveBeenCalled()
    const { docs } = await accounts()
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ email: PREVIEW_ADMIN_EMAIL, role: 'admin' })
    expect(PREVIEW_ADMIN_EMAIL.endsWith('@example.com')).toBe(true)
  })

  it('leaves a database that has accounts as it is, so a redeploy changes nothing', async () => {
    const before = (await accounts()).docs[0]
    expect(await seedPreviewDatabase(payload, PREVIEW)).toBe('kept')
    const { docs, totalDocs } = await accounts()
    expect(totalDocs).toBe(1)
    expect(docs[0].updatedAt).toBe(before.updatedAt)
  })

  it('gives the account a password nobody knows: it can’t sign in with a guess even once verified', async () => {
    const [account] = (await accounts()).docs
    expect(account._verified).toBe(false) // nobody can sign in until it is verified
    // Verified, as opening an emailed link would: only the password guards the account now
    await payload.db.updateOne({
      collection: 'users',
      id: account.id,
      data: { _verified: true },
      returning: false,
    })
    for (const guess of ['password', 'admin', 'preview', 'preview-admin', 'changeme', '']) {
      await expect(
        payload.login({
          collection: 'users',
          data: { email: PREVIEW_ADMIN_EMAIL, password: guess },
        }),
      ).rejects.toThrow()
    }
  })
})
