import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { bootPayload, NO_REVALIDATE, paragraph } from '@/platform/payload/testing/inMemoryPayload'

vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))

/**
 * "Top issues" (#484) on in-memory SQLite, end to end: a page holding the block saves, the page
 * query reads it back as a visitor sees it with its links' posts and pages populated, and news
 * maps it. A link to a draft post isn't populated for a visitor, so that issue is left out.
 */

let payload: Payload

const create = <T extends 'posts' | 'pages'>(collection: T, data: Record<string, unknown>) =>
  payload.create({
    collection,
    data: data as never,
    overrideAccess: true,
    context: NO_REVALIDATE,
  })

const lowHero = { type: 'lowImpact' as const }
const eventsIssue = { title: 'Events', link: { type: 'custom', url: '/events' } }
const topIssues = (items: unknown[]) => ({ blockType: 'topIssues', heading: 'Top issues', items })

beforeAll(async () => {
  ;({ payload } = await bootPayload())
}, 60_000)

describe('the top issues block, through the page query', () => {
  it('reads back with its post and page links populated, ready to draw', async () => {
    const roadWork = await create('posts', {
      title: 'Road work',
      slug: 'road-work',
      content: paragraph('The plan.'),
      _status: 'published',
    })
    const draft = await create('posts', {
      title: 'Not yet',
      slug: 'not-yet',
      content: paragraph('Soon.'),
      _status: 'draft',
    })
    const about = await create('pages', {
      title: 'About',
      slug: 'about',
      hero: lowHero,
      layout: [topIssues([eventsIssue])],
      _status: 'published',
    })
    await create('pages', {
      title: 'Home',
      slug: 'home',
      hero: lowHero,
      _status: 'published',
      layout: [
        {
          blockType: 'topIssues',
          heading: 'Top issues right now',
          reviewedAt: '2026-10-26T00:00:00.000Z',
          items: [
            {
              title: 'Road work on Sprecher Road',
              summary: 'What the city has planned.',
              link: { type: 'reference', reference: { relationTo: 'posts', value: roadWork.id } },
            },
            {
              title: 'A draft',
              link: { type: 'reference', reference: { relationTo: 'posts', value: draft.id } },
            },
            {
              title: 'About the neighborhood',
              link: { type: 'reference', reference: { relationTo: 'pages', value: about.id } },
            },
            {
              title: 'Talk it over',
              link: { type: 'custom', url: 'https://discourse.sprechereast.org', newTab: true },
            },
          ],
        },
      ],
    })

    const { getPageBySlug } = await import('@/modules/site/server')
    const { toTopIssuesBlockProps } = await import('@/modules/news/server')
    const page = await getPageBySlug('home')
    const block = page?.layout.find((b) => b.blockType === 'topIssues')
    if (block?.blockType !== 'topIssues') throw new Error('The page has no top issues block')

    expect(toTopIssuesBlockProps(block)).toEqual({
      id: expect.any(String),
      heading: 'Top issues right now',
      reviewedAt: '2026-10-26T00:00:00.000Z',
      items: [
        {
          title: 'Road work on Sprecher Road',
          summary: 'What the city has planned.',
          link: { href: '/posts/road-work', external: false },
        },
        {
          title: 'About the neighborhood',
          summary: null,
          link: { href: '/about', external: false },
        },
        {
          title: 'Talk it over',
          summary: null,
          link: { href: 'https://discourse.sprechereast.org', external: true },
        },
      ],
    })
  })

  it('refuses an issue without a title, no issues, and more than five', async () => {
    const save = (slug: string, items: unknown[]) =>
      create('pages', {
        title: 'Busy',
        slug,
        hero: lowHero,
        _status: 'published',
        layout: [topIssues(items)],
      })

    await expect(
      save(
        'five',
        Array.from({ length: 5 }, () => eventsIssue),
      ),
    ).resolves.toBeDefined()
    await expect(save('untitled', [{ ...eventsIssue, title: '' }])).rejects.toThrow(/Title/)
    await expect(save('none', [])).rejects.toThrow(/Items/)
    await expect(
      save(
        'six',
        Array.from({ length: 6 }, () => eventsIssue),
      ),
    ).rejects.toThrow(/Items/)
  })
})
