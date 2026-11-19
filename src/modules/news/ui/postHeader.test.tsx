// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'
import { MetaBar } from '@/platform/ui/MetaBar'
import { PageHeader } from '@/platform/ui/PageHeader'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PostDetail } from '../domain/types'
import { postByline, postHeaderProps } from './postHeader'

/** A post's byline as the page draws it: the facts above the article text (#774) */
const Byline = ({ post }: { post: PostDetail }) => <MetaBar items={postByline(post)} />

afterEach(cleanup)

const photo = { id: 3, alt: 'Neighbors at the park', url: '/api/media/file/park.webp' } as ImageRef

const post: PostDetail = {
  id: 7,
  slug: 'road-study',
  href: '/posts/road-study',
  title: 'Road study hearings',
  publishedAt: '2026-10-01T12:00:00.000Z',
  categories: [{ id: 1, title: 'Transportation' }],
  description: null,
  image: null,
  source: null,
  heroImage: photo,
  backdrop: null,
  content: {
    root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
  },
  authors: ['Ana', 'Ben'],
  relatedPosts: [],
  createdAt: '2026-09-30T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  meta: { title: null, description: null, image: null },
}

describe('postHeaderProps', () => {
  it('heads a post on a plain band with its categories and title, whether or not it has a picture (#461, #1013)', () => {
    for (const heroImage of [photo, null]) {
      const props = postHeaderProps({ ...post, heroImage })
      expect(props).toMatchObject({ variant: 'band', title: 'Road study hearings' })
      expect(props).not.toHaveProperty('image')

      const { container } = render(<PageHeader {...props} />)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Road study hearings')
      expect(container.querySelector('img')).toBeNull()
      cleanup()
    }
  })

  it('carries the post’s backdrop to the band and plates its category over it (#1024)', () => {
    const backdrop = { phone: null, tablet: null, desktop: photo }
    const props = postHeaderProps({ ...post, backdrop })
    expect(props).toMatchObject({ variant: 'band', backdrop })

    render(<PageHeader {...props} />)
    expect(screen.getByText('Transportation').parentElement?.className).toContain('bg-surface')
  })

  it('keeps the plain band, with its category pill as before, when there is no backdrop (#1024)', () => {
    const props = postHeaderProps(post)
    expect(props).toMatchObject({ backdrop: null })

    render(<PageHeader {...props} />)
    expect(screen.getByText('Transportation').parentElement?.className).not.toContain('bg-surface')
  })

  it('leaves the author, date and source out of the header: the page puts them above the text (#774)', () => {
    for (const heroImage of [photo, null]) {
      cleanup()
      render(<PageHeader {...postHeaderProps({ ...post, heroImage })} />)
      expect(screen.queryByText('Author')).toBeNull()
      expect(screen.queryByText('Published')).toBeNull()
    }
  })

  it('sets the title and the category in the page’s own colors, never white text on the page', () => {
    render(<PageHeader {...postHeaderProps({ ...post, authors: [] })} />)

    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-foreground')
    expect(screen.getByText('Transportation').className).toContain('text-primary-strong')
  })

  describe('postByline (#774)', () => {
    it('lists the authors and the date, in that order', () => {
      render(<Byline post={post} />)

      expect(screen.getByText('Author').nextElementSibling?.textContent).toBe('Ana and Ben')
      expect(screen.getByText('Published').nextElementSibling?.querySelector('time')).not.toBeNull()
      expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
        'Author',
        'Published',
      ])
    })

    it('leaves out the author when a post has none', () => {
      render(<Byline post={{ ...post, authors: [] }} />)

      expect(screen.queryByText('Author')).toBeNull()
      expect(screen.getByText('Published')).toBeDefined()
    })

    it('is empty for a post with no author and no date', () => {
      expect(postByline({ ...post, authors: [], publishedAt: null })).toEqual([])
    })

    it('shows only the author and the date, never the source (#1055)', () => {
      const withSource = {
        ...post,
        source: { name: 'City of Madison', url: 'https://example.com' },
      }

      expect(postByline(withSource).map((item) => item.label)).toEqual(['Author', 'Published'])
      render(<Byline post={withSource} />)
      expect(screen.queryByText('Source')).toBeNull()
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('gives the author names as the title of the cut value, so a long name keeps its full text', () => {
      const names = { ...post, authors: ['Bartholomew Featherstonehaugh-Kowalczyk', 'Cy'] }
      const [author] = postByline(names)

      expect(author?.title).toBe('Bartholomew Featherstonehaugh-Kowalczyk and Cy')
    })

    it('has no accessibility violations', async () => {
      const { container } = render(<Byline post={post} />)

      await expectAccessible(container)
    })

    it('writes the date compactly, so it stays on one line', () => {
      render(<Byline post={post} />)

      const date = screen.getByText('Published').nextElementSibling
      expect(date?.textContent).toMatch(/^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/)
    })
  })
})
