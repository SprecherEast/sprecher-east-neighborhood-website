import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { isNoOne, serverOnlyFieldAccess } from '@/platform/payload/roles'

import { PasskeyChallenges } from './passkeyChallenges'

const fields = PasskeyChallenges.fields.filter(
  (f): f is Field & { name: string } => 'name' in f && typeof f.name === 'string',
)

describe('PasskeyChallenges collection (decision 0021)', () => {
  it('is named passkey-challenges', () => {
    expect(PasskeyChallenges.slug).toBe('passkey-challenges')
  })

  it('gives no one access over any API, admins included', () => {
    expect(PasskeyChallenges.access).toEqual({
      read: isNoOne,
      create: isNoOne,
      update: isNoOne,
      delete: isNoOne,
    })
  })

  it('stays out of the admin navigation', () => {
    expect(PasskeyChallenges.admin?.hidden).toBe(true)
  })

  it('stores the purpose, challenge, expiry, use and account, all server-only', () => {
    expect(fields.map((f) => f.name)).toEqual([
      'purpose',
      'challenge',
      'expiresAt',
      'usedAt',
      'account',
    ])
    for (const f of fields) {
      expect((f as { access?: unknown }).access, f.name).toBe(serverOnlyFieldAccess)
    }
  })

  it('indexes the expiry, which the retention task filters on', () => {
    expect(fields.find((f) => f.name === 'expiresAt')).toMatchObject({
      index: true,
      required: true,
    })
  })

  it('only lets the two purposes in', () => {
    const purpose = fields.find((f) => f.name === 'purpose') as unknown as {
      options: Array<{ value: string }>
    }
    expect(purpose.options.map((o) => o.value)).toEqual(['add', 'sign-in'])
  })
})
