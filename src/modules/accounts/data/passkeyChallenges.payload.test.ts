import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { bootPayload } from '@/platform/payload/testing/inMemoryPayload'

import { NOW as now, makeAccount, minutesAfter as minutes } from '../testing/passkeyStore'
import type * as Challenges from './passkeyChallenges'

/**
 * The one-time challenge (#1313, decision 0021) against real Payload on an in-memory SQLite
 * database: taken once, never when expired or for another purpose, and once even when many
 * takes arrive at the same moment.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let challenges: typeof Challenges

beforeAll(async () => {
  payload = (await bootPayload()).payload
  challenges = await import('./passkeyChallenges')
}, 60_000)

describe('a challenge is taken once', () => {
  const make = (over: Partial<Parameters<typeof challenges.createChallenge>[0]> = {}) =>
    challenges.createChallenge({
      purpose: 'sign-in',
      challenge: 'random-challenge',
      accountId: null,
      now,
      ...over,
    })

  it('gives what the answer is checked against, once', async () => {
    const accountId = await makeAccount(payload)
    const id = await make({ purpose: 'add', accountId, challenge: 'for-an-add' })

    expect(await challenges.takeChallenge({ id, purpose: 'add', now: minutes(1) })).toEqual({
      id,
      purpose: 'add',
      challenge: 'for-an-add',
      accountId,
    })
    // A second take fails, and so does a replay later
    expect(await challenges.takeChallenge({ id, purpose: 'add', now: minutes(1) })).toBeNull()
    expect(await challenges.takeChallenge({ id, purpose: 'add', now: minutes(2) })).toBeNull()
  })

  it('names no account for a sign-in', async () => {
    const id = await make()
    expect(await challenges.takeChallenge({ id, purpose: 'sign-in', now })).toMatchObject({
      accountId: null,
    })
  })

  it('fails once expired, and the expiry is the lifetime after it was made', async () => {
    const id = await make()
    expect(await challenges.takeChallenge({ id, purpose: 'sign-in', now: minutes(5) })).toBeNull()
    expect(await challenges.takeChallenge({ id, purpose: 'sign-in', now: minutes(60) })).toBeNull()
    // Still inside its lifetime, an unused one works
    const fresh = await make()
    expect(await challenges.takeChallenge({ id: fresh, purpose: 'sign-in', now: minutes(4) })).not.toBeNull()
  })

  it('fails for another purpose, and leaves the challenge for the right one', async () => {
    const id = await make({ purpose: 'sign-in' })
    expect(await challenges.takeChallenge({ id, purpose: 'add', now })).toBeNull()
    expect(await challenges.takeChallenge({ id, purpose: 'sign-in', now })).not.toBeNull()
  })

  it('fails for an id that is not a challenge', async () => {
    for (const id of [0, -1, 9_999_999, 1.5, Number.NaN]) {
      expect(await challenges.takeChallenge({ id, purpose: 'sign-in', now })).toBeNull()
    }
  })

  it('succeeds once when many takes arrive at the same moment', async () => {
    const id = await make()
    const takes = await Promise.all(
      Array.from({ length: 12 }, () => challenges.takeChallenge({ id, purpose: 'sign-in', now })),
    )
    expect(takes.filter((taken) => taken !== null)).toHaveLength(1)
  })

  it('puts the identifier inside the where, not as id, and filters on its own columns only', async () => {
    const id = await make()
    const spy = vi.spyOn(payload.db, 'updateOne')
    try {
      await challenges.takeChallenge({ id, purpose: 'sign-in', now })
      expect(spy).toHaveBeenCalledTimes(1)
      const args = spy.mock.calls[0]?.[0] as unknown as {
        id?: unknown
        where: { and: Array<Record<string, unknown>> }
      }
      // An `id` argument would skip the conditions and read first
      expect(args.id).toBeUndefined()
      const keys = args.where.and.flatMap((clause) => Object.keys(clause))
      // Own columns only: a dotted path (a join) falls back to read-then-update
      expect(keys.sort()).toEqual(['expiresAt', 'id', 'purpose', 'usedAt'])
      expect(args.where.and).toContainEqual({ id: { equals: id } })
    } finally {
      spy.mockRestore()
    }
  })

  it('never reads or deletes first', async () => {
    const id = await make()
    const deleteOne = vi.spyOn(payload.db, 'deleteOne')
    const find = vi.spyOn(payload, 'find')
    const findOne = vi.spyOn(payload.db, 'findOne')
    try {
      await challenges.takeChallenge({ id, purpose: 'sign-in', now })
      expect(deleteOne).not.toHaveBeenCalled()
      expect(find).not.toHaveBeenCalled()
      expect(findOne).not.toHaveBeenCalled()
    } finally {
      deleteOne.mockRestore()
      find.mockRestore()
      findOne.mockRestore()
    }
  })
})

