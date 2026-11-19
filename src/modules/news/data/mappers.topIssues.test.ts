import { describe, expect, it } from 'vitest'

import type { Page, Post, TopIssuesBlock } from '@/payload-types'

import { toTopIssuesBlockProps } from './mappers'

type Item = TopIssuesBlock['items'][number]

const postLink = (slug: string): Item['link'] => ({
  type: 'reference',
  reference: { relationTo: 'posts', value: { id: 1, slug } as Post },
})
const pageLink = (slug: string): Item['link'] => ({
  type: 'reference',
  reference: { relationTo: 'pages', value: { id: 2, slug } as Page },
})
const urlLink = (url: string, newTab = false): Item['link'] => ({ type: 'custom', url, newTab })

const item = (title: string, link: Item['link'], summary: string | null = null): Item => ({
  title,
  summary,
  link,
})

const block = (items: Item[], extra: Partial<TopIssuesBlock> = {}) => ({
  id: 'b1',
  heading: 'Top issues right now',
  reviewedAt: '2026-10-26T00:00:00.000Z',
  items,
  ...extra,
})

describe('toTopIssuesBlockProps (#484)', () => {
  it('links each issue to its post, its page or its full URL, in the editor’s order', () => {
    const props = toTopIssuesBlockProps(
      block([
        item('Road work on Sprecher Road', postLink('road-work'), '  The city’s plan.  '),
        item('Get involved', pageLink('get-involved')),
        item('Talk it over', urlLink('https://discourse.sprechereast.org/t/1', true)),
      ]),
    )

    expect(props).toEqual({
      id: 'b1',
      heading: 'Top issues right now',
      reviewedAt: '2026-10-26T00:00:00.000Z',
      items: [
        {
          title: 'Road work on Sprecher Road',
          summary: 'The city’s plan.',
          link: { href: '/posts/road-work', external: false },
        },
        { title: 'Get involved', summary: null, link: { href: '/get-involved', external: false } },
        {
          title: 'Talk it over',
          summary: null,
          link: { href: 'https://discourse.sprechereast.org/t/1', external: true },
        },
      ],
    })
  })

  it('keeps a path on this site as a custom URL', () => {
    const props = toTopIssuesBlockProps(block([item('Events', urlLink('/events'))]))

    expect(props?.items.map(({ link }) => link.href)).toEqual(['/events'])
  })

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,hi',
    'mailto:someone@example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    // Browsers drop tabs and line breaks, so these would leave the site
    '/\t/evil.example.com',
    '/\n/evil.example.com',
    '/\r\\evil.example.com',
    // Resolve against the page instead of naming a host
    'https:evil.example.com',
    'https:/evil.example.com',
    'not a url',
  ])('drops an issue whose custom URL is %j', (url) => {
    const props = toTopIssuesBlockProps(
      block([item('Unsafe', urlLink(url)), item('Safe', urlLink('/events'))]),
    )

    expect(props?.items.map(({ title }) => title)).toEqual(['Safe'])
  })

  it('drops an issue with no title, or with a post the reader may not see or that is gone', () => {
    const props = toTopIssuesBlockProps(
      block([
        item('   ', postLink('road-work')),
        // Unpublished for this reader: Payload leaves the id unpopulated
        item('Draft post', { type: 'reference', reference: { relationTo: 'posts', value: 7 } }),
        item('Deleted post', { type: 'reference', reference: null }),
        item('No link at all', undefined),
        item('Kept', postLink('kept')),
      ]),
    )

    expect(props?.items.map(({ title }) => title)).toEqual(['Kept'])
  })

  it('shows at most five issues, the first five that can be shown', () => {
    const items = ['1', '2', '3', '4', '5', '6', '7'].map((n) => item(`Issue ${n}`, urlLink(`/${n}`)))
    const props = toTopIssuesBlockProps(block([item('', urlLink('/0')), ...items]))

    expect(props?.items.map(({ title }) => title)).toEqual([
      'Issue 1',
      'Issue 2',
      'Issue 3',
      'Issue 4',
      'Issue 5',
    ])
  })

  it('gives no props when no issue is left, so the block draws nothing', () => {
    expect(toTopIssuesBlockProps(block([item('Unsafe', urlLink('javascript:void(0)'))]))).toBeNull()
    expect(toTopIssuesBlockProps(block([]))).toBeNull()
  })

  it('falls back to the default heading, and leaves the date out when the editor set none', () => {
    const props = toTopIssuesBlockProps(
      block([item('Events', urlLink('/events'))], { heading: ' ', reviewedAt: null, id: null }),
    )

    expect(props).toEqual({
      heading: 'Top issues right now',
      reviewedAt: null,
      items: [{ title: 'Events', summary: null, link: { href: '/events', external: false } }],
    })
  })
})
