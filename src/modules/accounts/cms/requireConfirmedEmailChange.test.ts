import { describe, expect, it } from 'vitest'

import { NEW_EMAIL_CONFIRMED } from '../domain/emailChange'
import { requireConfirmedEmailChange } from './requireConfirmedEmailChange'

type HookArgs = Parameters<typeof requireConfirmedEmailChange>[0]

const run = (over: {
  data?: Record<string, unknown>
  context?: Record<string, unknown>
  userId?: number | null
  operation?: 'create' | 'update'
}) =>
  requireConfirmedEmailChange({
    collection: { slug: 'users' },
    context: over.context ?? {},
    data: over.data ?? {},
    operation: over.operation ?? 'update',
    originalDoc: { id: 1, email: 'old@example.com' },
    req: {
      user:
        over.userId === null || over.userId === undefined
          ? null
          : { id: over.userId, collection: 'users' },
    },
  } as unknown as HookArgs)

describe('requireConfirmedEmailChange', () => {
  it('refuses a new email on your own account', () => {
    expect(() => run({ data: { email: 'new@example.com' }, userId: 1 })).toThrow(/can’t be changed/)
  })

  it('lets the confirm-by-link flow through', () => {
    const data = { email: 'new@example.com' }
    expect(run({ data, userId: 1, context: { [NEW_EMAIL_CONFIRMED]: true } })).toBe(data)
  })

  it('lets an admin change another account', () => {
    const data = { email: 'new@example.com' }
    expect(run({ data, userId: 2 })).toBe(data)
  })

  it('lets server code without a user change it', () => {
    const data = { email: 'new@example.com' }
    expect(run({ data, userId: null })).toBe(data)
  })

  it('ignores an update that keeps the same email, in any letter case', () => {
    const data = { email: ' OLD@example.com ' }
    expect(run({ data, userId: 1 })).toBe(data)
  })

  it('ignores updates without an email and new accounts', () => {
    const data = { name: 'X' }
    expect(run({ data, userId: 1 })).toBe(data)
    const created = { email: 'new@example.com' }
    expect(run({ data: created, userId: 1, operation: 'create' })).toBe(created)
  })
})
