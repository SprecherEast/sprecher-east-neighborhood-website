import type { PayloadRequest, TaskConfig } from 'payload'

import { RETENTION_SCHEDULE, withoutPersonalData } from '@/platform/payload/retentionJobs'

import { PASSKEY_CHALLENGES } from '../domain/passkeys'

/**
 * Deletes the challenges past their expiry, with one conditional DELETE, and says how many. A
 * challenge lives minutes, and a used one expires soon after, so expired-only is enough: nothing
 * else is touched, and a challenge still open stays (#1313, decision 0021).
 */
export async function deleteExpiredChallenges(
  req: PayloadRequest,
  now = Date.now(),
): Promise<number> {
  const where = { expiresAt: { less_than: new Date(now).toISOString() } }
  const { totalDocs } = await req.payload.db.count({ collection: PASSKEY_CHALLENGES, where, req })
  if (totalDocs === 0) return 0
  await req.payload.db.deleteMany({ collection: PASSKEY_CHALLENGES, where, req })
  return totalDocs
}

/** The task's slug in Payload's jobs queue. */
export const PASSKEY_CHALLENGE_RETENTION_TASK = 'deleteExpiredPasskeyChallenges'

/** The hourly retention task for the challenges, for `payload.config.ts`. It logs a count only. */
export const passkeyChallengeRetentionTask: TaskConfig<{
  input: object
  output: { deleted: number }
}> = {
  slug: PASSKEY_CHALLENGE_RETENTION_TASK,
  label: 'Delete expired passkey challenges',
  schedule: RETENTION_SCHEDULE,
  handler: async ({ req }) => {
    const deleted = await withoutPersonalData(PASSKEY_CHALLENGE_RETENTION_TASK, () =>
      deleteExpiredChallenges(req),
    )
    req.payload.logger.info(`Retention: deleted ${deleted} expired passkey challenges`)
    return { output: { deleted } }
  },
}
