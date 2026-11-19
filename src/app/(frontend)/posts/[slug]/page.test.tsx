// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { richTextBlocks } from '@/platform/richtext/richTextBlocks'
import { READING_COLUMN } from '@/platform/ui/layoutSizes'

// The modules are replaced: this tests the page's wiring, not news, events or the renderer
const mocks = vi.hoisted(() => ({
  getPostBySlug: vi.fn(),
  richText: vi.fn(),
  redirects: vi.fn(),
  forumPrompt: vi.fn(),
}))
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock('@/modules/news/server', () => ({
  findRecentPosts: async () => [],
  getPostBySlug: mocks.getPostBySlug,
  listPostSlugs: async () => [],
  postHeaderProps: () => ({ title: 'Park cleanup' }),
  postByline: () => [{ label: 'Author', value: 'Ana' }],
  postJsonLd: () => ({}),
  SidebarPosts: () => null,
}))
vi.mock('@/modules/events/server', () => ({
  findUpcomingEvents: async () => [],
  SidebarEvents: () => null,
}))
vi.mock('@/platform/richtext/RichText', () => ({
  RichText: (props: unknown) => {
    mocks.richText(props)
    return null
  },
}))
vi.mock('@/modules/site/server', () => ({
  getForumUrl: async () => 'https://forum.example.org',
  ForumPrompt: (props: unknown) => {
    mocks.forumPrompt(props)
    return null
  },
  PayloadRedirects: (props: unknown) => {
    mocks.redirects(props)
    return null
  },
}))
import PostPage from './page'

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe('/posts/[slug]', () => {
  it('renders the post’s content with the rich-text blocks a post may hold', async () => {
    const content = { root: { type: 'root', children: [] } }
    mocks.getPostBySlug.mockResolvedValue({ slug: 'park-cleanup', title: 'Park cleanup', content })

    render(await PostPage(params('park-cleanup')))

    expect(mocks.getPostBySlug).toHaveBeenCalledWith('park-cleanup')
    expect(mocks.richText).toHaveBeenCalledWith(
      expect.objectContaining({ data: content, blocks: richTextBlocks }),
    )
    // Under the post, the prompt to discuss it on the forum (#485)
    expect(mocks.forumPrompt).toHaveBeenCalledWith({ href: 'https://forum.example.org' })
  })

  it('puts the byline above the text, and keeps a text-only post at the reading width (#774)', async () => {
    const content = { root: { type: 'root', children: [] } }
    mocks.getPostBySlug.mockResolvedValue({ slug: 'park-cleanup', title: 'Park cleanup', content })

    render(await PostPage(params('park-cleanup')))

    expect(screen.getByText('Author')).toBeDefined()
    // The metadata bar takes the text's width, so its line ends on the text's right edge
    expect(
      screen.getByText('Author').closest('dl')?.parentElement?.parentElement?.className,
    ).toContain('mx-0')
    expect(mocks.richText).toHaveBeenCalledWith(
      expect.objectContaining({ className: READING_COLUMN }),
    )
  })

  it('lets a post with card blocks fill the column (#774)', async () => {
    const content = {
      root: { type: 'root', children: [{ type: 'block', fields: { blockType: 'factTabs' } }] },
    }
    mocks.getPostBySlug.mockResolvedValue({ slug: 'budget', title: 'Budget', content })

    render(await PostPage(params('budget')))

    expect(mocks.richText).toHaveBeenCalledWith(expect.objectContaining({ className: undefined }))
  })

  it('asks neighbors kindly for tips in the sidebar, and links to Get Involved', async () => {
    const content = { root: { type: 'root', children: [] } }
    mocks.getPostBySlug.mockResolvedValue({ slug: 'park-cleanup', title: 'Park cleanup', content })

    render(await PostPage(params('park-cleanup')))

    expect(screen.getByText('Know something we’re missing? Please tell us.')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Get Involved' }).getAttribute('href')).toBe(
      '/get-involved',
    )
    expect(screen.queryByText(/stronger Sprecher East community/)).toBeNull()
  })

  it('follows a redirect, or answers 404, when there is no such post', async () => {
    mocks.getPostBySlug.mockResolvedValue(null)

    render(await PostPage(params('gone')))

    expect(mocks.redirects).toHaveBeenCalledWith({ url: '/posts/gone' })
    expect(mocks.richText).not.toHaveBeenCalled()
  })
})
