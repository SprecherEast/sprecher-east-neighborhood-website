import type { MigrateUpArgs } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { SCHEDULED_PUBLISH_QUEUE } from '@/platform/payload/jobRunners'
import {
  MISSED_SCHEDULE_MESSAGE,
  up as cancelMissedSchedules,
} from './migrations/20261024_180000_cancel_missed_scheduled_publishes'

/**
 * Scheduled publishing (#141): the Admin's Schedule button queues Payload's `schedulePublish`
 * task with the scheduling user, and the app runs `SCHEDULED_PUBLISH_QUEUE`. This checks that
 * Payload puts the task in that queue, that running the queue publishes a due post as that user,
 * and that the one-time migration cancels schedules missed while nothing ran the queue. Payload
 * runs on an in-memory SQLite database: no file, no network.
 */

// The posts' revalidation hook needs a Next.js request, which a test doesn't have
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let payload: Payload
let editorId: number
let residentId: number

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'scheduled-publishing-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  const config = await (await import('@payload-config')).default
  payload = await getPayload({ config })
  const account = async (email: string, role: 'admin' | 'editor' | 'resident') =>
    (
      await payload.create({
        collection: 'users',
        data: { email, password: 'scheduled-test-password', name: role, role },
        disableVerificationEmail: true,
        overrideAccess: true,
      })
    ).id
  // The first account on an empty database becomes an admin (#354), so it is not the editor
  await account('admin@example.com', 'admin')
  editorId = await account('editor@example.com', 'editor')
  residentId = await account('resident@example.com', 'resident')
}, 60_000)

const paragraph = (text: string) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal' }],
      },
    ],
  },
})

const draftPost = (slug: string) =>
  payload.create({
    collection: 'posts',
    data: { title: slug, slug, content: paragraph('Soon.'), _status: 'draft' },
    draft: true,
    overrideAccess: true,
  })

/** What the Admin's Schedule button queues (`schedulePublishHandler` in @payloadcms/ui). */
const schedule = (postId: number, userId: number, waitUntil: Date) =>
  payload.jobs.queue({
    task: 'schedulePublish',
    input: {
      type: 'publish',
      doc: { relationTo: 'posts', value: postId },
      user: { relationTo: 'users', value: userId },
    },
    waitUntil,
  })

const status = async (id: number) =>
  (await payload.findByID({ collection: 'posts', id, depth: 0, draft: true, overrideAccess: true }))
    ._status

const job = (id: number | string) =>
  payload.findByID({ collection: 'payload-jobs', id, depth: 0, overrideAccess: true })

const SOON = () => new Date(Date.now() - 1000)
const LATER = () => new Date(Date.now() + 60 * 60 * 1000)

describe('scheduled publishing', () => {
  it('publishes a due post as the editor who scheduled it, in the app runner’s queue', async () => {
    const post = await draftPost('by-editor')
    const queued = await schedule(post.id, editorId, SOON())
    expect(queued.queue).toBe(SCHEDULED_PUBLISH_QUEUE)

    await payload.jobs.run({ queue: SCHEDULED_PUBLISH_QUEUE })

    expect(await status(post.id)).toBe('published')
  })

  it('doesn’t publish what a resident scheduled: they may not publish', async () => {
    const post = await draftPost('by-resident')
    const queued = await schedule(post.id, residentId, SOON())

    await payload.jobs.run({ queue: SCHEDULED_PUBLISH_QUEUE })

    expect(await status(post.id)).toBe('draft')
    expect((await job(queued.id)).hasError).toBe(true)
  })

  it('leaves a post that isn’t due yet as a draft', async () => {
    const post = await draftPost('later')
    await schedule(post.id, editorId, LATER())

    await payload.jobs.run({ queue: SCHEDULED_PUBLISH_QUEUE })

    expect(await status(post.id)).toBe('draft')
  })
})

describe('the migration for schedules missed while nothing ran them', () => {
  it('cancels a schedule already due, and leaves one still ahead to run', async () => {
    const missed = await draftPost('missed')
    const ahead = await draftPost('ahead')
    const missedJob = await schedule(missed.id, editorId, SOON())
    const aheadJob = await schedule(ahead.id, editorId, LATER())
    const notice = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    await cancelMissedSchedules({ payload, req: { payload } } as unknown as MigrateUpArgs)
    await payload.jobs.run({ queue: SCHEDULED_PUBLISH_QUEUE })

    expect(notice).toHaveBeenCalledWith(expect.stringMatching(/::notice .*::1 missed schedule/))
    notice.mockRestore()
    expect(await status(missed.id)).toBe('draft')
    expect(await job(missedJob.id)).toMatchObject({
      hasError: true,
      error: { message: MISSED_SCHEDULE_MESSAGE },
    })
    const stillAhead = await job(aheadJob.id)
    expect(stillAhead.hasError).toBeFalsy()
    expect(stillAhead.completedAt).toBeFalsy()
  })
})
