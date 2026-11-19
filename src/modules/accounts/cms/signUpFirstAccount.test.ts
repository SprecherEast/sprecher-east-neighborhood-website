import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { SIGN_UP_CONTEXT } from '../domain/signUpContext'
import { bootPayload } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The public sign-up never makes an admin (#520, #354): even as the first account on an empty
 * database it is a guest. Only Payload's own first registration promotes (`payload.config.roles.test.ts`).
 */

let payload: Payload

beforeAll(async () => {
  ;({ payload } = await bootPayload())
}, 60_000)

describe('sign-up on an empty database', () => {
  it('creates a guest, as the sign-up action creates it', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: 'ana@example.com', password: 'a-long-password-for-tests', role: 'guest' },
      context: { [SIGN_UP_CONTEXT]: true },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    expect(created.role).toBe('guest')
  })
})
