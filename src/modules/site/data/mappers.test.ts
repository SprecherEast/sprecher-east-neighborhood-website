import { describe, expect, it } from 'vitest'

import type {
  ArchiveBlock,
  ContentBlock,
  Header,
  MapBlock,
  MediaBlock,
  Page,
  TopIssuesBlock,
} from '@/payload-types'

import {
  toArchiveBlockProps,
  toCallToActionBlockProps,
  toContentBlockProps,
  toContentLayout,
  toHeaderNavLinks,
  toPageLayout,
} from './mappers'

type Column = NonNullable<ContentBlock['columns']>[number]
type RichText = NonNullable<Column['richText']>

/** Rich text whose top-level nodes have these types */
const richText = (...types: string[]): RichText => ({
  root: {
    type: 'root',
    children: types.map((type) => ({ type, version: 1 })),
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

const text = richText('heading', 'paragraph')
const title = richText('heading')
const link = { type: 'custom', url: '/events', label: 'See events', appearance: 'outline' } as const

const column = (size: Column['size'], extra: Partial<Column> = {}): Column => ({
  size,
  richText: text,
  ...extra,
})

describe('toContentLayout', () => {
  it.each([
    [['full'], 'single'],
    [['oneThird'], 'single'],
    [['full', 'full'], 'single'],
    [[], 'single'],
    [['twoThirds', 'oneThird'], 'columns'],
    [['full', 'half'], 'columns'],
    [['half', 'half'], 'cards'],
    [['oneThird', 'oneThird', 'oneThird'], 'cards'],
    [['full', 'oneThird', 'oneThird', 'oneThird'], 'cards'],
    [['oneThird', 'oneThird', 'oneThird', 'oneThird'], 'stats'],
    [['half', 'half', 'half', 'half'], 'stats'],
  ] as const)('lays out %j as %s', (sizes, layout) => {
    expect(toContentLayout([...sizes])).toBe(layout)
  })

  it('counts a column with no size as not full, as it always has', () => {
    expect(toContentLayout([null, 'full'])).toBe('columns')
    expect(toContentLayout([null, null, null, null])).toBe('stats')
  })
})

describe('toContentBlockProps', () => {
  it('keeps each column’s size, text and link, defaulting the size to full', () => {
    const props = toContentBlockProps({
      columns: [column(null, { enableLink: true, link })],
    })

    expect(props).toEqual({
      layout: 'single',
      columns: [
        {
          size: 'full',
          body: text,
          link: { href: '/events', label: 'See events', external: false, appearance: 'outline' },
        },
      ],
    })
  })

  it('drops a link the editor turned off, or one that goes nowhere', () => {
    const props = toContentBlockProps({
      columns: [
        column('twoThirds', { enableLink: false, link }),
        column('oneThird', { enableLink: true, link: { ...link, url: '' } }),
      ],
    })

    expect(props).toEqual({
      layout: 'columns',
      columns: [
        { size: 'twoThirds', body: text },
        { size: 'oneThird', body: text },
      ],
    })
  })

  it('makes a heading-only column the title of the cards after it', () => {
    const props = toContentBlockProps({
      columns: [
        column('full', { richText: title }),
        column('oneThird'),
        column('oneThird'),
        column('full', { richText: title }),
        column('half'),
      ],
    })

    expect(props).toEqual({
      layout: 'cards',
      groups: [
        {
          title,
          cards: [
            { size: 'oneThird', body: text },
            { size: 'oneThird', body: text },
          ],
        },
        { title, cards: [{ size: 'half', body: text }] },
      ],
    })
  })

  it('keeps a heading-only column with a link as a card, and cards before any title untitled', () => {
    const props = toContentBlockProps({
      columns: [
        column('oneThird'),
        column('oneThird'),
        column('oneThird', { richText: title, enableLink: true, link }),
      ],
    })

    expect(props.layout === 'cards' && props.groups).toEqual([
      {
        cards: [
          expect.objectContaining({ body: text }),
          expect.objectContaining({ body: text }),
          expect.objectContaining({ body: title }),
        ],
      },
    ])
  })

  it('treats a column holding only a heading as text outside the cards layout', () => {
    const props = toContentBlockProps({ columns: [column('full', { richText: title })] })

    expect(props).toEqual({ layout: 'single', columns: [{ size: 'full', body: title }] })
  })

  it('has no columns when the editor added none', () => {
    expect(toContentBlockProps({ columns: null })).toEqual({ layout: 'single', columns: [] })
  })
})

describe('toCallToActionBlockProps', () => {
  it('resolves its links and drops one that goes nowhere', () => {
    const props = toCallToActionBlockProps({
      richText: text,
      links: [{ link }, { link: { type: 'reference', reference: null, label: 'Gone' } }],
    })

    expect(props).toEqual({
      body: text,
      links: [{ href: '/events', label: 'See events', external: false, appearance: 'outline' }],
    })
  })

  it('has no text or links when the editor left them empty', () => {
    expect(toCallToActionBlockProps({ richText: null, links: null })).toEqual({ links: [] })
  })
})

describe('toArchiveBlockProps', () => {
  it('keeps the anchor and the intro', () => {
    expect(toArchiveBlockProps({ id: 'a1', introContent: text })).toEqual({ id: 'a1', intro: text })
    expect(toArchiveBlockProps({ id: null, introContent: null })).toEqual({})
  })
})

describe('toPageLayout', () => {
  const archive: ArchiveBlock = {
    blockType: 'archive',
    id: 'a1',
    introContent: text,
    populateBy: 'collection',
    categories: [3],
    limit: 6,
  }
  const media: MediaBlock = { blockType: 'mediaBlock', id: 'm1', media: 1 }
  // news maps it in the block registry (#484), so site passes it on untouched
  const topIssues: TopIssuesBlock = {
    blockType: 'topIssues',
    id: 't1',
    heading: 'Top issues',
    items: [{ title: 'Events', link: { type: 'custom', url: '/events' } }],
  }

  const map: MapBlock = {
    blockType: 'mapBlock',
    id: 'p1',
    title: 'Where we are',
    description: 'Our boundary.',
    embedUrl: null,
    preview: 1,
  }

  it('maps site’s blocks to props and keeps the others as stored', () => {
    const layout = toPageLayout([
      { blockType: 'content', columns: [column('full')] },
      { blockType: 'cta', links: [] },
      archive,
      media,
      topIssues,
      map,
    ])

    expect(layout).toEqual([
      { blockType: 'content', layout: 'single', columns: [{ size: 'full', body: text }] },
      { blockType: 'cta', links: [] },
      {
        blockType: 'archive',
        id: 'a1',
        intro: text,
        postQuery: { populateBy: 'collection', categories: [3], limit: 6, selectedDocs: undefined },
      },
      media,
      topIssues,
      { blockType: 'mapBlock', title: 'Where we are', description: 'Our boundary.' },
    ])
  })

  it('drops a block type the site no longer has', () => {
    const old = [{ blockType: 'gallery' }] as unknown as Page['layout']

    expect(toPageLayout(old)).toEqual([])
  })
})

describe('toHeaderNavLinks', () => {
  const item = (label: string, url: string, newTab = false) => ({
    link: { type: 'custom' as const, label, url, newTab },
  })
  const header = (...navItems: NonNullable<Header['navItems']>): Header => ({ id: 1, navItems })

  it('turns the editors’ nav items into plain links, in order', () => {
    expect(toHeaderNavLinks(header(item('Events', '/events'), item('City', 'https://x.test', true)))).toEqual([
      { href: '/events', label: 'Events', external: false },
      { href: 'https://x.test', label: 'City', external: true },
    ])
  })

  it('resolves a link to a page by its address', () => {
    const page = {
      link: {
        type: 'reference' as const,
        label: 'About',
        reference: { relationTo: 'pages' as const, value: { id: 2, slug: 'about' } as never },
      },
    }

    expect(toHeaderNavLinks(header(page))).toEqual([
      { href: '/about', label: 'About', external: false },
    ])
  })

  it('leaves out a Contact link, which the header shows as its own button', () => {
    expect(toHeaderNavLinks(header(item('Events', '/events'), item('Contact', '/contact')))).toHaveLength(1)
  })

  it('leaves out a link that goes nowhere, and copes with no nav items', () => {
    const gone = { link: { type: 'reference' as const, label: 'Gone', reference: null } }

    expect(toHeaderNavLinks(header(gone))).toEqual([])
    expect(toHeaderNavLinks({})).toEqual([])
  })
})
