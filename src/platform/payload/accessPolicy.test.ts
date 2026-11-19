import type { SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  type AccessFn,
  accessResult,
  allows,
  type Audience,
  AUDIENCES,
  loadConfig,
} from './testing/accessHarness'

/**
 * Policy test for the whole data model. It loads the real Payload config (no database) and
 * checks every collection and global, including those added by plugins and by Payload itself,
 * against what visitors and residents may do. A new collection, a plugin default or a missing
 * `access` entry fails here instead of reaching production (#140).
 */

type Operation = 'read' | 'create' | 'update' | 'delete' | 'readVersions' | 'unlock'
const PUBLIC = ['visitor', 'guest', 'resident', 'agent'] satisfies Audience[]
// Signed-in accounts of any non-staff role. Guest and resident have the same access until
// residency checks exist (#520, #314)
const SIGNED_IN = ['guest', 'resident', 'agent'] satisfies Audience[]
const AGENT_ONLY = ['agent'] satisfies Audience[]

/** Everything visitors and residents may do. Anything missing here must be denied. */
const ALLOWED: Record<string, Partial<Record<Operation, Audience[]>>> = {
  // Content: published documents only (authenticatedOrPublished returns a filter)
  pages: { read: PUBLIC },
  // Agents may suggest: held as drafts for review by `holdSuggestions` (#123, #336)
  posts: { read: PUBLIC, create: AGENT_ONLY },
  events: { read: PUBLIC, create: AGENT_ONLY },
  faq: { read: PUBLIC },
  resources: { read: PUBLIC },
  // Public reference data
  categories: { read: PUBLIC },
  media: { read: PUBLIC },
  'team-members': { read: PUBLIC },
  search: { read: PUBLIC },
  // Visitors need a form's fields to fill it in, and may send a submission
  forms: { read: PUBLIC },
  'form-submissions': { create: PUBLIC },
  // Payload's own: each user's admin preferences, filtered to their own rows
  'payload-preferences': {
    read: SIGNED_IN,
    create: SIGNED_IN,
    update: SIGNED_IN,
    delete: SIGNED_IN,
  },
  // An agent's own run history (read and update return a filter on `agent`)
  'agent-runs': { read: AGENT_ONLY, create: AGENT_ONLY, update: AGENT_ONLY },
  // What an agent reports for editors: it adds its own (to its own runs) and reads them
  'agent-review-items': { read: AGENT_ONLY, create: AGENT_ONLY },
  // `payload-mcp-api-keys` is admin-only (#336)
  // `email-confirmations` is admin-only: the server writes it with access bypassed (#183)
  // Payload's own edit locks are staff-only (`restrictEditLocks`, #147), so not listed here
  // Payload's own, with no REST or GraphQL endpoints (`endpoints: false`)
  'payload-migrations': {
    read: SIGNED_IN,
    create: SIGNED_IN,
    update: SIGNED_IN,
    delete: SIGNED_IN,
  },
  // Globals
  header: { read: PUBLIC },
  footer: { read: PUBLIC },
}

let config: SanitizedConfig

beforeAll(async () => {
  config = await loadConfig()
}, 60_000)

describe('collections', () => {
  it('let visitors and residents do only what the policy allows', async () => {
    const problems: string[] = []
    for (const collection of config.collections) {
      // Version history and unlocking only exist where versions and logins do
      const operations: Operation[] = ['read', 'create', 'update', 'delete']
      if (collection.versions) operations.push('readVersions')
      if (collection.auth) operations.push('unlock')
      for (const operation of operations) {
        for (const audience of Object.keys(AUDIENCES) as Audience[]) {
          const expected = ALLOWED[collection.slug]?.[operation]?.includes(audience) ?? false
          const actual = await allows(collection.access[operation], audience, 99)
          if (actual !== expected) {
            problems.push(`${collection.slug}.${operation} for ${audience}: ${actual}`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('show visitors and residents only published documents where drafts exist', async () => {
    const withDrafts = config.collections.filter(
      (c) => typeof c.versions === 'object' && c.versions.drafts,
    )
    expect(withDrafts.map((c) => c.slug).sort()).toEqual(
      ['events', 'faq', 'pages', 'posts', 'resources'].sort(),
    )
    for (const collection of withDrafts) {
      for (const audience of ['visitor', 'guest', 'resident'] as const) {
        expect(await accessResult(collection.access.read, audience)).toEqual({
          _status: { equals: 'published' },
        })
      }
    }
  })

  // A noindex header only asks search engines (#280): this is what keeps the data private. The
  // REST API runs these same functions for `GET /api/<slug>` and `GET /api/<slug>/<id>`
  it.each(['users', 'form-submissions', 'email-confirmations', 'payload-jobs', 'redirects'])(
    'refuse anonymous reads of %s, as a list or one document',
    async (slug) => {
      const collection = config.collections.find((c) => c.slug === slug)
      expect(collection).toBeDefined()
      expect(await allows(collection?.access.read, 'visitor')).toBe(false)
      expect(await allows(collection?.access.read, 'visitor', 1)).toBe(false)
    },
  )

  it('keep agents out of accounts, messages, the admin panel and content changes (#336)', async () => {
    const find = (slug: string) => config.collections.find((c) => c.slug === slug)
    for (const slug of ['users', 'form-submissions', 'payload-mcp-api-keys']) {
      expect(await allows(find(slug)?.access.read, 'agent')).toBe(false)
    }
    for (const slug of ['events', 'posts']) {
      for (const operation of ['update', 'delete', 'readVersions'] as const) {
        expect(await allows(find(slug)?.access[operation], 'agent')).toBe(false)
      }
    }
    expect(await accessResult(find('agent-runs')?.access.read, 'agent')).toEqual({
      agent: { equals: 8 },
    })
    expect(await allows(find('users')?.access.admin, 'agent')).toBe(false)
  })

  // A key can authenticate REST requests as the key document itself: it must count as nobody,
  // even where its id matches an account's
  it('treat an API key acting as itself as signed out', async () => {
    const key = { req: { user: { id: 1, collection: 'payload-mcp-api-keys' } }, id: 1 }
    const users = config.collections.find((c) => c.slug === 'users')
    for (const operation of ['read', 'update'] as const) {
      expect(await (users?.access[operation] as AccessFn)(key)).toBe(false)
    }
    const events = config.collections.find((c) => c.slug === 'events')
    expect(await (events?.access.create as AccessFn)(key)).toBe(false)
  })

  it('let a guest or resident reach their own user record and nobody else’s', async () => {
    const users = config.collections.find((c) => c.slug === 'users')
    expect(await allows(users?.access.update, 'guest', 6)).toBe(true)
    expect(await allows(users?.access.update, 'guest', 99)).toBe(false)
    expect(await allows(users?.access.read, 'guest', 6)).toBe(true)
    expect(await allows(users?.access.update, 'resident', 7)).toBe(true)
    expect(await allows(users?.access.update, 'resident', 99)).toBe(false)
    expect(await allows(users?.access.read, 'resident', 7)).toBe(true)
  })

  it('let only admins reach email confirmations, which hold typed addresses (#183)', async () => {
    const confirmations = config.collections.find((c) => c.slug === 'email-confirmations')
    const editor = { req: { user: { id: 2, role: 'editor', collection: 'users' } } }
    const admin = { req: { user: { id: 1, role: 'admin', collection: 'users' } } }
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      const access = confirmations?.access[operation] as AccessFn
      expect(await access(editor)).toBe(false)
      expect(await access(admin)).toBe(true)
    }
    const hidden = confirmations?.fields.filter((f) => 'hidden' in f && f.hidden)
    expect(hidden?.map((f) => ('name' in f ? f.name : ''))).toContain('tokenHash')
  })

  it('have no collection missing from the policy review', () => {
    const reviewed = new Set([
      ...Object.keys(ALLOWED),
      'users',
      'redirects',
      'email-confirmations',
      'payload-kv',
    ])
    const unreviewed = config.collections
      .map((c) => c.slug)
      .filter((slug) => !reviewed.has(slug) && !slug.startsWith('payload-'))
    expect(unreviewed).toEqual([])
  })
})

describe('globals', () => {
  it('let visitors and residents only read them', async () => {
    const problems: string[] = []
    for (const global of config.globals) {
      const operations: Operation[] = ['read', 'update']
      if (global.versions) operations.push('readVersions')
      for (const operation of operations) {
        for (const audience of Object.keys(AUDIENCES) as Audience[]) {
          const expected = ALLOWED[global.slug]?.[operation]?.includes(audience) ?? false
          const access = (global.access as Record<string, unknown>)[operation]
          const actual = await allows(access, audience)
          if (actual !== expected) problems.push(`${global.slug}.${operation} for ${audience}`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe('jobs', () => {
  it('let only staff queue or cancel jobs, and only admins run them', async () => {
    const access = config.jobs.access ?? {}
    for (const audience of Object.keys(AUDIENCES) as Audience[]) {
      expect(await allows(access.queue, audience)).toBe(false)
      expect(await allows(access.cancel, audience)).toBe(false)
      expect(await allows(access.run, audience)).toBe(false)
    }
    const editor = { req: { user: { id: 2, role: 'editor', collection: 'users' } } }
    const admin = { req: { user: { id: 1, role: 'admin', collection: 'users' } } }
    expect(await (access.queue as AccessFn)(editor)).toBe(true)
    expect(await (access.run as AccessFn)(editor)).toBe(false)
    expect(await (access.run as AccessFn)(admin)).toBe(true)
  })

  it('run the retention queue and scheduled publishing in the app (#274, #141)', () => {
    expect(config.jobs.autoRun).toEqual([
      { cron: '*/10 * * * *', queue: 'retention' },
      { cron: '* * * * *', queue: 'default', limit: 10, disableScheduling: true },
    ])
    const scheduled = (config.jobs.tasks ?? [])
      .filter((task) => task.schedule?.some((schedule) => schedule.queue === 'retention'))
      .map((task) => task.slug)
    expect(scheduled.sort()).toEqual([
      'deleteExpiredContactMessages',
      'deleteExpiredEmailConfirmations',
    ])
    // The every-minute runner only runs what editors scheduled: no task schedules itself there
    const scheduleQueues = (config.jobs.tasks ?? []).flatMap((task) => task.schedule ?? [])
    expect(new Set(scheduleQueues.map((schedule) => schedule.queue))).toEqual(
      new Set(['retention']),
    )
  })
})
