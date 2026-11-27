import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sql } from '@payloadcms/db-sqlite'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { migrations } from '@/migrations'
import { down, up } from '@/migrations/20261126_170106_related_events'
import { paragraph } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The related-events migration (#1496), run the way production runs it: every migration in order on
 * an empty SQLite file, with the schema NOT built from the config (which would hide a foreign key the
 * migration got wrong). Foreign keys are on, as in libsql.
 */

let payload: Payload
const folder = mkdtempSync(path.join(tmpdir(), 'related-events-migration-'))
const ctx = { disableRevalidate: true }

type Rows<T> = { rows: T[] }
const all = async <T>(query: ReturnType<typeof sql>): Promise<T[]> =>
  (
    (await (
      payload.db.drizzle as unknown as { run: (q: ReturnType<typeof sql>) => Promise<unknown> }
    ).run(query)) as Rows<T>
  ).rows

type Step = typeof up | typeof down
type Drizzle = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> }
/** One migration step in a transaction, as `payload migrate` runs it. */
const run = async (step: Step) => {
  const req = await createLocalReq({}, payload)
  await (payload.db.drizzle as unknown as Drizzle).transaction((tx) =>
    step({ db: tx, payload, req } as unknown as MigrateUpArgs & MigrateDownArgs),
  )
}

beforeAll(async () => {
  // Payload builds the schema itself unless it believes it is in production
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URI', `file:${path.join(folder, 'migrated.db')}`)
  vi.stubEnv('PAYLOAD_SECRET', 'in-memory-test-secret-0123456789abcdef')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  const config = await (await import('@payload-config')).default
  payload = await getPayload({ config })
  for (const migration of migrations) await run(migration.up)
}, 120_000)

afterAll(async () => {
  await payload?.destroy()
  rmSync(folder, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('on a database built by the real migrations', () => {
  it('deletes an event that posts and post versions picked, and keeps the post', async () => {
    const event = await payload.create({
      collection: 'events',
      context: ctx,
      data: { title: 'Walk', slug: 'walk', date: '2027-03-01T00:00:00.000Z', _status: 'published' },
    })
    const post = await payload.create({
      collection: 'posts',
      context: ctx,
      data: {
        title: 'Recap',
        slug: 'recap',
        content: paragraph('News.'),
        relatedEvents: [event.id],
        _status: 'published',
      },
    })
    // A second version without the pick: the first version still points at the event
    await payload.update({
      collection: 'posts',
      id: post.id,
      context: ctx,
      data: { relatedEvents: [], _status: 'published' },
    })

    await payload.delete({ collection: 'events', id: event.id, context: ctx })

    const kept = await payload.findByID({ collection: 'posts', id: post.id, depth: 0 })
    expect(kept.slug).toBe('recap')
    expect(await all(sql`SELECT 1 FROM posts_rels WHERE events_id IS NOT NULL`)).toEqual([])
    expect(await all(sql`SELECT 1 FROM _posts_v_rels WHERE events_id IS NOT NULL`)).toEqual([])
  })
})

describe('rolling the migration back and applying it again', () => {
  it('leaves no pick without a target, then works again', async () => {
    const event = await payload.create({
      collection: 'events',
      context: ctx,
      data: { title: 'Fair', slug: 'fair', date: '2027-04-01T00:00:00.000Z', _status: 'published' },
    })
    const post = await payload.create({
      collection: 'posts',
      context: ctx,
      data: {
        title: 'Fair recap',
        slug: 'fair-recap',
        content: paragraph('News.'),
        relatedEvents: [event.id],
        _status: 'published',
      },
    })

    await run(down)
    for (const table of ['posts_rels', '_posts_v_rels']) {
      expect(await all(sql.raw(`SELECT 1 FROM ${table} WHERE path = 'relatedEvents'`))).toEqual([])
      const columns = await all<{ name: string }>(sql.raw(`PRAGMA table_info(${table})`))
      expect(columns.map((c) => c.name)).not.toContain('events_id')
    }

    await run(up)
    await payload.delete({ collection: 'events', id: event.id, context: ctx })
    expect((await payload.findByID({ collection: 'posts', id: post.id, depth: 0 })).slug).toBe(
      'fair-recap',
    )
  })
})
