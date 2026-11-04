import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'
import {
  bootWithAdmin,
  BAR,
  post,
  rest,
  SHAPES,
  tab,
  tabs,
  TIMELINE,
} from '@/platform/payload/testing/factTabsRequests'
import { FACT_TABS_FIXTURE } from '@/platform/richtext/editorial/factTabsFixtures'
import { toFactTabsProps } from '@/platform/richtext/editorial/factTabs'

/**
 * Saving the Fact tabs block in posts and events (#664) with the real config on in-memory SQLite:
 * the limits and the nested chart and timeline rules refuse a bad save over the Local API and REST,
 * for posts and events. Publishing: `payload.config.factTabsPublish.test.ts`.
 */

let payload: Payload
let config: SanitizedConfig
let token = ''
beforeAll(async () => {
  ;({ payload, config, token } = await bootWithAdmin())
}, 60_000)

const collections = ['posts', 'events'] as const

describe('saving a Fact tabs block', () => {
  it.each(collections)(
    'stores the four-tab fixture in %s, with nested charts and a timeline',
    async (collection) => {
      const data = SHAPES[collection](FACT_TABS_FIXTURE as never)
      const doc = await payload.create({
        collection,
        data: data as never,
        context: NO_REVALIDATE,
        overrideAccess: true,
      })
      const stored = JSON.stringify(doc.content)
      expect(stored).toContain('"blockType":"factTabs"')
      expect(stored).toContain('"blockType":"timeline"')
      expect(stored).toContain('"blockType":"chart"')
      const block = (doc.content as unknown as { root: { children: { fields?: never }[] } }).root
        .children[0]?.fields as never
      expect(toFactTabsProps(block).tabs).toHaveLength(4)
    },
  )

  it.each([2, 3, 4])('stores %i tabs', async (n) => {
    await expect(
      payload.create({
        collection: 'posts',
        data: post({ tabs: tabs(n) }) as never,
        context: NO_REVALIDATE,
        overrideAccess: true,
      }),
    ).resolves.toBeDefined()
  })

  const BAD = [
    ['one tab', { tabs: tabs(1) }],
    ['five tabs', { tabs: tabs(5) }],
    ['no tabs', { tabs: [] }],
    ['an empty heading', { tabs: [tab({ heading: '' }), tab()] }],
    ['a heading of only spaces', { tabs: [tab({ heading: ' ' }), tab()] }],
    ['a heading over 40 characters', { tabs: [tab({ heading: 'x'.repeat(41) }), tab()] }],
    ['an empty definition', { tabs: [tab({ definition: '' }), tab()] }],
    ['a definition of only spaces', { tabs: [tab({ definition: '  ' }), tab()] }],
    ['a definition over 240 characters', { tabs: [tab({ definition: 'x'.repeat(241) }), tab()] }],
    ['no value', { tabs: [tab({ value: '' }), tab()] }],
    ['a tab with no pictures', { tabs: [tab({ panel: [] }), tab()] }],
    ['three pictures', { tabs: [tab({ panel: [BAR, TIMELINE, BAR] }), tab()] }],
    ['an invalid chart (no title)', { tabs: [tab({ panel: [{ ...BAR, title: '' }] }), tab()] }],
    [
      'an invalid chart (negative number)',
      { tabs: [tab({ panel: [{ ...BAR, bars: [{ label: 'A', value: -1 }] }] }), tab()] },
    ],
    [
      'an invalid chart sent as a count',
      { tabs: [tab({ panel: [{ ...BAR, title: '', bars: 2 }] }), tab()] },
    ],
    [
      'a one-milestone timeline',
      { tabs: [tab({ panel: [{ ...TIMELINE, entries: [TIMELINE.entries[0]] }] }), tab()] },
    ],
    [
      'two "Next up" milestones',
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
    ['a link with no text', { tabs: [tab({ linkUrl: 'https://example.com' }), tab()] }],
    [
      'a javascript: link',
      { tabs: [tab({ linkLabel: 'x', linkUrl: 'javascript:alert(1)' }), tab()] },
    ],
  ] as const

  it.each(collections.flatMap((c) => BAD.map(([name, fields]) => [c, name, fields] as const)))(
    'refuses, in %s, %s (Local API)',
    async (collection, _name, fields) => {
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

  it.each(collections.flatMap((c) => BAD.map(([name, fields]) => [c, name, fields] as const)))(
    'answers 400, in %s, for %s (REST)',
    async (collection, _name, fields) => {
      const response = await rest(
        config,
        token,
        'POST',
        [collection],
        SHAPES[collection](fields as never) as never,
      )
      expect(response.status).toBe(400)
    },
  )

  it.each(collections)(
    'accepts a valid block over REST in %s, saved as a draft',
    async (collection) => {
      const response = await rest(
        config,
        token,
        'POST',
        [collection],
        SHAPES[collection]({ tabs: tabs(2) }, 'draft') as never,
        '?draft=true',
      )
      expect(response.status).toBe(201)
    },
  )
})
