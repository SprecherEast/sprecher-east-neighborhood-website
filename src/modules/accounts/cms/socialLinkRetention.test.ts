import type { PayloadRequest, TaskHandler } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { RETENTION_SCHEDULE } from '@/platform/payload/retentionJobs'

import {
  deleteExpiredLinkRequests,
  SOCIAL_LINK_RETENTION_TASK,
  socialLinkRetentionTask,
} from './socialLinkRetention'

const NOW = Date.parse('2026-11-20T12:00:00.000Z')

const fakeRequest = (count: number) => {
  const db = { count: vi.fn(async () => ({ totalDocs: count })), deleteMany: vi.fn(async () => {}) }
  const info = vi.fn()
  const req = { payload: { db, logger: { info } } } as unknown as PayloadRequest
  return { db, info, req }
}

describe('deleteExpiredLinkRequests (#1338)', () => {
  it('deletes by expiry only, with one conditional DELETE, and says how many', async () => {
    const { db, req } = fakeRequest(3)
    expect(await deleteExpiredLinkRequests(req, NOW)).toBe(3)
    const where = { expiresAt: { less_than: '2026-11-20T12:00:00.000Z' } }
    expect(db.count).toHaveBeenCalledWith({ collection: 'social-link-requests', where, req })
    expect(db.deleteMany).toHaveBeenCalledWith({ collection: 'social-link-requests', where, req })
  })

  it('deletes nothing when nothing expired', async () => {
    const { db, req } = fakeRequest(0)
    expect(await deleteExpiredLinkRequests(req, NOW)).toBe(0)
    expect(db.deleteMany).not.toHaveBeenCalled()
  })
})

describe('socialLinkRetentionTask', () => {
  it('runs on the retention schedule under its own slug', () => {
    expect(socialLinkRetentionTask.slug).toBe(SOCIAL_LINK_RETENTION_TASK)
    expect(socialLinkRetentionTask.schedule).toBe(RETENTION_SCHEDULE)
  })

  it('logs a count only, never a Google id or an email', async () => {
    const { info, req } = fakeRequest(2)
    const handler = socialLinkRetentionTask.handler as TaskHandler<never>
    expect(await handler({ req } as never)).toEqual({ output: { deleted: 2 } })
    expect(info).toHaveBeenCalledWith('Retention: deleted 2 expired pending Google links')
  })
})
