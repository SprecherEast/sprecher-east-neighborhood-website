import { type ComponentProps, isValidElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { PageBlockComponents } from '@/modules/site/server'

// The modules are replaced with stand-ins: this tests which module draws each block type
const modules = vi.hoisted(() => ({
  findArchivePosts: vi.fn(),
  PostGrid: () => null,
  FormBlock: () => null,
  ArchiveBlock: () => null,
  CallToActionBlock: () => null,
  ContentBlock: () => null,
  MapBlock: () => null,
  findEventsThisWeek: vi.fn(),
  EventsThisWeek: () => null,
  toTopIssuesBlockProps: vi.fn(),
  TopIssuesBlock: () => null,
}))
vi.mock('@/modules/news/server', () => ({
  findArchivePosts: modules.findArchivePosts,
  PostGrid: modules.PostGrid,
  toTopIssuesBlockProps: modules.toTopIssuesBlockProps,
  TopIssuesBlock: modules.TopIssuesBlock,
}))
vi.mock('@/modules/contact/server', () => ({ FormBlock: modules.FormBlock }))
vi.mock('@/modules/events/server', () => ({
  findEventsThisWeek: modules.findEventsThisWeek,
  EventsThisWeek: modules.EventsThisWeek,
}))
vi.mock('@/modules/site/server', () => ({
  ArchiveBlock: modules.ArchiveBlock,
  CallToActionBlock: modules.CallToActionBlock,
  ContentBlock: modules.ContentBlock,
  MapBlock: modules.MapBlock,
}))

import { MediaBlock } from '@/platform/richtext/MediaBlock'

import { pageBlocks } from './pageBlocks'

describe('pageBlocks', () => {
  it('draws each block type with its module’s component', () => {
    expect(pageBlocks.content).toBe(modules.ContentBlock)
    expect(pageBlocks.cta).toBe(modules.CallToActionBlock)
    expect(pageBlocks.formBlock).toBe(modules.FormBlock)
    expect(pageBlocks.mediaBlock).toBe(MediaBlock)
    expect(pageBlocks.mapBlock).toBe(modules.MapBlock)
  })

  it('draws the archive block around the posts news loads for it', async () => {
    const posts = [{ id: 1, slug: 'park-cleanup' }]
    modules.findArchivePosts.mockResolvedValue(posts)
    const postQuery = { populateBy: 'collection' as const, limit: 3 }
    const block: ComponentProps<PageBlockComponents['archive']> = {
      blockType: 'archive',
      id: 'a1',
      postQuery,
    }

    const element = (await (pageBlocks.archive as (b: typeof block) => unknown)(
      block,
    )) as ReactElement<{ children: ReactElement }>

    expect(modules.findArchivePosts).toHaveBeenCalledWith(postQuery)
    expect(element.type).toBe(modules.ArchiveBlock)
    expect(element.props).toMatchObject({ id: 'a1' })
    expect(isValidElement(element.props.children)).toBe(true)
    expect(element.props.children.type).toBe(modules.PostGrid)
    expect(element.props.children.props).toEqual({ posts })
  })

  it('draws the "this week" strip with the props events loads for it (#122)', async () => {
    const props = { heading: 'This week', rows: [], allEventsHref: '/events' }
    modules.findEventsThisWeek.mockResolvedValue(props)
    const rows = [{ title: 'Coming up', source: 'all' as const, limit: 3 }]
    const block: ComponentProps<PageBlockComponents['eventsThisWeek']> = {
      blockType: 'eventsThisWeek',
      id: 'w1',
      heading: 'This week',
      days: 7,
      rows,
      disableInnerContainer: true,
    }

    const element = (await (pageBlocks.eventsThisWeek as (b: typeof block) => unknown)(
      block,
    )) as ReactElement

    expect(modules.findEventsThisWeek).toHaveBeenCalledWith({
      id: 'w1',
      heading: 'This week',
      days: 7,
      rows,
    })
    expect(element.type).toBe(modules.EventsThisWeek)
    expect(element.props).toEqual(props)
  })

  const topIssues: ComponentProps<PageBlockComponents['topIssues']> = {
    blockType: 'topIssues',
    id: 't1',
    heading: 'Top issues right now',
    reviewedAt: null,
    items: [{ title: 'Events', link: { type: 'custom', url: '/events' } }],
    disableInnerContainer: true,
  }
  const drawTopIssues = () =>
    (pageBlocks.topIssues as (b: typeof topIssues) => unknown)(topIssues) as ReactElement | null

  it('draws top issues with the props news maps from the stored block (#484)', () => {
    const props = { heading: 'Top issues right now', reviewedAt: null, items: [] }
    modules.toTopIssuesBlockProps.mockReturnValue(props)

    const element = drawTopIssues()

    expect(modules.toTopIssuesBlockProps).toHaveBeenCalledWith({
      id: 't1',
      heading: 'Top issues right now',
      reviewedAt: null,
      items: topIssues.items,
    })
    expect(element?.type).toBe(modules.TopIssuesBlock)
    expect(element?.props).toEqual(props)
  })

  it('draws nothing for top issues when news leaves no issue to show', () => {
    modules.toTopIssuesBlockProps.mockReturnValue(null)

    expect(drawTopIssues()).toBeNull()
  })
})
