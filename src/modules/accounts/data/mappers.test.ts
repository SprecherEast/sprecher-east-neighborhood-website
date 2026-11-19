import { describe, expect, it } from 'vitest'

import { toCurrentUser } from './mappers'

describe('toCurrentUser', () => {
  it('keeps only the id, email, name and role', () => {
    const user = {
      id: 7,
      email: 'ada@example.com',
      name: 'Ada',
      role: 'editor' as const,
      sessions: [{ id: 's1', expiresAt: '2026-10-22T00:00:00.000Z' }],
      collection: 'users' as const,
    }
    expect(toCurrentUser(user)).toEqual({
      id: 7,
      email: 'ada@example.com',
      name: 'Ada',
      role: 'editor',
    })
  })

  it('gives an account with no name `null`', () => {
    expect(toCurrentUser({ id: 1, email: 'a@example.com', role: 'admin' }).name).toBeNull()
    const unnamed = { id: 1, email: 'a@example.com', role: 'admin' as const, name: '' }
    expect(toCurrentUser(unnamed).name).toBeNull()
  })

  it('treats an account without a role as a guest, like the access checks do', () => {
    expect(toCurrentUser({ id: 1, email: 'a@example.com', role: null }).role).toBe('guest')
  })
})
