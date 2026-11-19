import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'
import {
  bootWithAdmin,
  content,
  node,
  rest,
  SHAPES,
  tabs,
} from '@/platform/payload/testing/factTabsRequests'
import { present } from '@/platform/payload/testing/present'

/**
 * An invalid Fact tabs block cannot be published by any route (#664): Local API update, REST PATCH,
 * bulk update, a draft copy, and a draft over a published block, in posts and events.
 */

let payload: Payload
let config: SanitizedConfig
let token = ''
beforeAll(async () => {
  ;({ payload, config, token } = await bootWithAdmin())
}, 60_000)

const collections = ['posts', 'events'] as const

describe('an invalid Fact tabs block cannot be published by any route', () => {
  const draftWithBadBlock = async (collection: (typeof collections)[number]) => {
    const data = SHAPES[collection]({ tabs: tabs(1) }, 'draft')
    return payload.create({
      collection,
      data: data as never,
      draft: true,
      context: NO_REVALIDATE,
      overrideAccess: true,
    })
  }

  it.each(collections)(
    'stays a draft in %s: publishing by Local API update is refused',
    async (collection) => {
      const doc = await draftWithBadBlock(collection)
      await expect(
        payload.update({
          collection,
          id: doc.id,
          data: { _status: 'published' },
          context: NO_REVALIDATE,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    },
  )

  it.each(collections)(
    'stays a draft in %s: publishing by REST PATCH is refused',
    async (collection) => {
      const doc = await draftWithBadBlock(collection)
      const response = await rest(config, token, 'PATCH', [collection, String(doc.id)], {
        _status: 'published',
      })
      expect(response.status).toBe(400)
    },
  )

  it.each(collections)(
    'stays a draft in %s: bulk publishing reports the error',
    async (collection) => {
      const doc = await draftWithBadBlock(collection)
      const result = await payload.update({
        collection,
        where: { id: { equals: doc.id } },
        data: { _status: 'published' },
        context: NO_REVALIDATE,
        overrideAccess: true,
      })
      expect(result.errors.length).toBe(1)
      expect(result.docs).toHaveLength(0)
      const response = await rest(
        config,
        token,
        'PATCH',
        [collection],
        { _status: 'published' },
        `?where[id][equals]=${doc.id}`,
      )
      expect(JSON.stringify(await response.json())).toMatch(/error/i)
      const after = await payload.findByID({
        collection,
        id: doc.id,
        draft: true,
        overrideAccess: true,
      })
      expect(after._status).toBe('draft')
    },
  )

  it.each(collections)('stays a draft in %s: a draft copy is not published', async (collection) => {
    const doc = await draftWithBadBlock(collection)
    const copy = await payload.duplicate({
      collection,
      id: doc.id,
      draft: true,
      overrideAccess: true,
    })
    expect(copy._status).toBe('draft')
  })

  it.each(collections)(
    'stays unpublished in %s: a draft saved over a published block does not change what readers see',
    async (collection) => {
      const good = await payload.create({
        collection,
        data: SHAPES[collection]({ tabs: tabs(2) }) as never,
        context: NO_REVALIDATE,
        overrideAccess: true,
      })
      await payload.update({
        collection,
        id: good.id,
        draft: true,
        data: { content: content(node({ tabs: tabs(1) })) as never, _status: 'draft' },
        context: NO_REVALIDATE,
        overrideAccess: true,
      })
      const live = await payload.findByID({
        collection,
        id: good.id,
        draft: false,
        overrideAccess: true,
      })
      expect(JSON.stringify(live.content)).toContain('Tab 2')
      // Restoring that draft version as the published one is refused too
      const { docs } = await payload.findVersions({
        collection,
        where: { parent: { equals: good.id } },
        sort: '-updatedAt',
        limit: 1,
        overrideAccess: true,
      })
      const bad = docs[0]
      expect(bad?.version._status).toBe('draft')
      const restored = await payload
        .restoreVersion({ collection, id: present(bad).id, overrideAccess: true })
        .catch(() => null)
      expect(restored === null || restored._status === 'draft').toBe(true)
    },
  )
})
