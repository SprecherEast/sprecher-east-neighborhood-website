import type { PayloadRequest, TaskConfig } from 'payload'

import { RETENTION_SCHEDULE, withoutPersonalData } from '@/platform/payload/retentionJobs'

import { SOCIAL_LINK_REQUESTS } from '../domain/googleLink'
import { deleteExpiredRows } from './expiredRows'

/** Deletes the pending Google links past their expiry and says how many (#1338). */
export function deleteExpiredLinkRequests(req: PayloadRequest, now = Date.now()): Promise<number> {
  return deleteExpiredRows(req, SOCIAL_LINK_REQUESTS, now)
}

/** The task's slug in Payload's jobs queue. */
export const SOCIAL_LINK_RETENTION_TASK = 'deleteExpiredSocialLinkRequests'

/** The hourly retention task for the pending links, for `payload.config.ts`. It logs a count only. */
export const socialLinkRetentionTask: TaskConfig<{
  input: object
  output: { deleted: number }
}> = {
  slug: SOCIAL_LINK_RETENTION_TASK,
  label: 'Delete expired pending Google links',
  schedule: RETENTION_SCHEDULE,
  handler: async ({ req }) => {
    const deleted = await withoutPersonalData(SOCIAL_LINK_RETENTION_TASK, () =>
      deleteExpiredLinkRequests(req),
    )
    req.payload.logger.info(`Retention: deleted ${deleted} expired pending Google links`)
    return { output: { deleted } }
  },
}
