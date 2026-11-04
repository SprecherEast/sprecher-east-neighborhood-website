import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  bootWithAdmin,
  rest,
  SHAPES,
  tab,
  tabs,
  TIMELINE,
} from '@/platform/payload/testing/factTabsRequests'
import { type Account, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

/**
 * A list sent as a number (Admin's row count) is no rows on a real save (#664 review). Payload's
 * own array validator reads the number as the count, so `entries: 2` passed `minRows: 2` and was
 * stored as an empty list; the Timeline's milestones and the Key facts' facts now count rows
 * themselves. Standalone and inside a fact tab's panel, posts and events, over the Local API (as
 * admin and as editor) and REST.
 */

let payload: Payload
let config: SanitizedConfig
let token = ''
let editor: Account
beforeAll(async () => {
  ;({ payload, config, token, editor } = await bootWithAdmin())
}, 60_000)

const collections = ['posts', 'events'] as const
const FACT = { value: '$2M', label: 'Cost', icon: 'money', certainty: 'confirmed' }
const FACTS = [FACT, { ...FACT, label: 'Other' }]

const BAD = [
  ['a Timeline with milestones sent as 2', { blockType: 'timeline', entries: 2 }],
  ['a Timeline with milestones sent as 5', { blockType: 'timeline', entries: 5 }],
  ['a Timeline with no milestones', { blockType: 'timeline', entries: [] }],
  [
    'a Timeline with 13 milestones',
    { blockType: 'timeline', entries: Array(13).fill(TIMELINE.entries[0]) },
  ],
  ['Key facts sent as 3', { blockType: 'keyFacts', facts: 3 }],
  ['Key facts with one fact', { blockType: 'keyFacts', facts: [FACT] }],
  ['Key facts with seven facts', { blockType: 'keyFacts', facts: Array(7).fill(FACT) }],
  [
    'a Timeline sent as 2 inside a fact tab',
    { tabs: [tab({ panel: [{ blockType: 'timeline', entries: 2 }] }), tab()] },
  ],
  [
    'two "Next up" milestones inside a fact tab',
    {
      tabs: [
        tab({
          panel: [
            {
              ...TIMELINE,
              entries: [...TIMELINE.entries, { date: 'x', status: 'next', title: 'y' }],
            },
          ],
        }),
        tab(),
      ],
    },
  ],
] as const

const GOOD = [
  ['a Timeline with two milestones', { blockType: 'timeline', entries: TIMELINE.entries }],
  ['Key facts with two facts', { blockType: 'keyFacts', facts: FACTS }],
  ['Key facts with six facts', { blockType: 'keyFacts', facts: Array(6).fill(FACT) }],
  ['fact tabs with a timeline', { tabs: tabs(2) }],
] as const

const cases = <T extends readonly (readonly [string, object])[]>(list: T) =>
  collections.flatMap((c) => list.map(([name, fields]) => [c, name, fields] as const))

describe('a list sent as a number', () => {
  it.each(cases(BAD))(
    'is refused in %s as admin: %s (Local API)',
    async (collection, _n, fields) => {
      await expect(
        payload.create({
          collection,
          data: SHAPES[collection](fields as never) as never,
          context: NO_REVALIDATE,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    },
  )

  it.each(cases(BAD))(
    'is refused in %s as an editor: %s (Local API)',
    async (collection, _n, fields) => {
      await expect(
        payload.create({
          collection,
          data: SHAPES[collection](fields as never) as never,
          context: NO_REVALIDATE,
          user: editor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    },
  )

  it.each(cases(BAD))('answers 400 in %s: %s (REST)', async (collection, _n, fields) => {
    const response = await rest(
      config,
      token,
      'POST',
      [collection],
      SHAPES[collection](fields as never) as never,
    )
    expect(response.status).toBe(400)
  })

  it.each(cases(GOOD))('still saves in %s: %s', async (collection, _n, fields) => {
    const doc = await payload.create({
      collection,
      data: SHAPES[collection](fields as never) as never,
      context: NO_REVALIDATE,
      overrideAccess: true,
    })
    expect(doc.id).toBeDefined()
  })

  it.each(collections)('cannot be published from a draft in %s', async (collection) => {
    const draft = await payload.create({
      collection,
      data: SHAPES[collection]({ blockType: 'timeline', entries: 2 }, 'draft') as never,
      draft: true,
      context: NO_REVALIDATE,
      overrideAccess: true,
    })
    await expect(
      payload.update({
        collection,
        id: draft.id,
        data: { _status: 'published' },
        context: NO_REVALIDATE,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    const response = await rest(config, token, 'PATCH', [collection, String(draft.id)], {
      _status: 'published',
    })
    expect(response.status).toBe(400)
  })
})
