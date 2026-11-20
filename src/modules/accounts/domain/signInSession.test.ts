import { describe, expect, it } from 'vitest'

import { sessionStartedAt } from './signInSession'

const sessions = [
  { id: 'old', createdAt: '2026-11-19T10:00:00.000Z' },
  { id: 'now', createdAt: '2026-11-19T11:58:00.000Z' },
  { id: 'no-time' },
  { id: 'bad-time', createdAt: 'yesterday-ish' },
]

describe('sessionStartedAt', () => {
  it('gives when the session the token names was started', () => {
    expect(sessionStartedAt(sessions, 'now')).toEqual(new Date('2026-11-19T11:58:00.000Z'))
    expect(sessionStartedAt(sessions, 'old')).toEqual(new Date('2026-11-19T10:00:00.000Z'))
  })

  it('counts a missing session, token id or time as no sign-in time', () => {
    expect(sessionStartedAt(sessions, 'unknown')).toBeNull()
    expect(sessionStartedAt(sessions, undefined)).toBeNull()
    expect(sessionStartedAt(sessions, 42)).toBeNull()
    expect(sessionStartedAt(sessions, 'no-time')).toBeNull()
    expect(sessionStartedAt(sessions, 'bad-time')).toBeNull()
    expect(sessionStartedAt(null, 'now')).toBeNull()
    expect(sessionStartedAt(undefined, 'now')).toBeNull()
  })
})
