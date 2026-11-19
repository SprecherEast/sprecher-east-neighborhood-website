import type { PayloadRequest, TaskHandler } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { RETENTION_SCHEDULE } from '@/platform/payload/retentionJobs'

import {
  PASSKEY_CHALLENGE_RETENTION_TASK,
  deleteExpiredChallenges,
  passkeyChallengeRetentionTask,
} from './passkeyRetention'

const NOW = Date.parse('2026-11-19T12:00:00.000Z')

const fakeRequest = (count: number) => {
  const db = { count: vi.fn(async () => ({ totalDocs: count })), deleteMany: vi.fn(async () => {}) }
  const info = vi.fn()
  const req = { payload: { db, logger: { info } } } as unknown as PayloadRequest
  return { db, info, req }
}

describe('deleteExpiredChallenges (#1313)', () => {
  it('deletes by expiry only, with one conditional DELETE, and says how many', async () => {
    const { db, req } = fakeRequest(3)
    expect(await deleteExpiredChallenges(req, NOW)).toBe(3)
    const where = { expiresAt: { less_than: '2026-11-19T12:00:00.000Z' } }
    expect(db.count).toHaveBeenCalledWith({ collection: 'passkey-challenges', where, req })
    expect(db.deleteMany).toHaveBeenCalledWith({ collection: 'passkey-challenges', where, req })
  })

  it('deletes nothing when nothing expired', async () => {
    const { db, req } = fakeRequest(0)
    expect(await deleteExpiredChallenges(req, NOW)).toBe(0)
    expect(db.deleteMany).not.toHaveBeenCalled()
  })
})

describe('passkeyChallengeRetentionTask', () => {
  it('runs on the retention schedule under its own slug', () => {
    expect(passkeyChallengeRetentionTask.slug).toBe(PASSKEY_CHALLENGE_RETENTION_TASK)
    expect(passkeyChallengeRetentionTask.schedule).toBe(RETENTION_SCHEDULE)
  })

  it('logs a count only, never a challenge', async () => {
    const { info, req } = fakeRequest(2)
    const handler = passkeyChallengeRetentionTask.handler as TaskHandler<never>
    const result = await handler({ req } as never)
    expect(result).toEqual({ output: { deleted: 2 } })
    expect(info).toHaveBeenCalledWith('Retention: deleted 2 expired passkey challenges')
  })

  it('fails with the task’s name and the error’s code, never a query’s parameters', async () => {
    const { db, req } = fakeRequest(1)
    db.deleteMany.mockRejectedValue(
      Object.assign(new Error('secret-challenge-value'), { code: 'SQLITE_BUSY' }),
    )
    const handler = passkeyChallengeRetentionTask.handler as TaskHandler<never>
    await expect(handler({ req } as never)).rejects.toThrow(
      `Retention task ${PASSKEY_CHALLENGE_RETENTION_TASK} failed (Error SQLITE_BUSY)`,
    )
  })
})
