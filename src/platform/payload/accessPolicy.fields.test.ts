import type { SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  type AccessFn,
  allows,
  type Audience,
  AUDIENCES,
  loadConfig,
} from './testing/accessHarness'
import { type FieldNode, fieldChildren } from './testing/configFields'

/**
 * Field-level access across the whole config (#140, #299): hidden fields refuse writes, and
 * private fields are hidden from visitors and residents. Collections, globals and jobs are in
 * `accessPolicy.test.ts`.
 */

let config: SanitizedConfig

beforeAll(async () => {
  config = await loadConfig()
}, 60_000)

describe('server-only fields', () => {
  type Node = FieldNode

  /** Every field below `fields`, nested ones included, as [path, field]. */
  const allFields = (fields: Node[], path: string): [string, Node][] =>
    fields.flatMap((field) => {
      const here = field.name ? `${path}.${field.name}` : path
      return [[here, field] as [string, Node], ...allFields(fieldChildren(field), here)]
    })

  const STAFF = [
    { id: 2, role: 'editor', collection: 'users' },
    { id: 1, role: 'admin', collection: 'users' },
  ]

  // Payload's own: an API key's lookup hash, which its `setAPIKeyIndex` hook always recomputes
  // from the key. Only admins reach the keys collection at all (#336)
  const PAYLOAD_DERIVED = ['payload-mcp-api-keys.apiKeyIndex']

  // `hidden: true` hides a field from reads only: Payload still accepts writes to it (#299)
  it('refuse writes to every hidden field, for everyone', async () => {
    const owners = [...config.collections, ...config.globals]
    const hidden = owners.flatMap((owner) =>
      allFields(owner.fields as Node[], owner.slug).filter(
        ([path, field]) => field.hidden && !PAYLOAD_DERIVED.includes(path),
      ),
    )
    expect(hidden.length).toBeGreaterThan(0)
    const problems: string[] = []
    for (const [path, field] of hidden) {
      for (const operation of ['create', 'update'] as const) {
        const access = field.access?.[operation]
        if (typeof access !== 'function') {
          problems.push(`${path}: no ${operation} access`)
          continue
        }
        for (const audience of Object.keys(AUDIENCES) as Audience[]) {
          if (await allows(access, audience)) problems.push(`${path}.${operation} for ${audience}`)
        }
        for (const user of STAFF) {
          if ((await (access as AccessFn)({ req: { user } })) !== false) {
            problems.push(`${path}.${operation} for ${user.role}`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe('private fields', () => {
  /** The field's own read rule, or undefined when the field has none. */
  const fieldReadAccess = (collection: string, name: string): unknown => {
    const field = config.collections
      .find((c) => c.slug === collection)
      ?.fields.find((f) => 'name' in f && f.name === name)
    return field && 'access' in field ? field.access?.read : undefined
  }

  it.each([
    ['team-members', 'email'],
    ['forms', 'emails'],
    // Would tell a visitor whether the address they typed is confirmed (#183)
    ['form-submissions', 'senderEmail'],
    ['form-submissions', 'emailConfirmed'],
    // Staff's reasons for keeping a message longer (#274)
    ['form-submissions', 'retentionHold'],
    ['form-submissions', 'retentionHoldReason'],
  ])('%s.%s is hidden from visitors and residents', async (collection, name) => {
    const read = fieldReadAccess(collection, name)
    expect(await allows(read, 'visitor')).toBe(false)
    expect(await allows(read, 'resident')).toBe(false)
  })
})
