// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'
import { PageHeader } from '@/platform/ui/PageHeader'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PostDetail } from '../domain/types'
import { postHeaderProps } from './postHeader'

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
  it('puts a post on its hero photo with its byline and date (#461)', () => {
    const props = postHeaderProps(post)
    expect(props).toMatchObject({ variant: 'image', image: photo, title: 'Road study hearings' })

    render(<PageHeader {...props} />)
    expect(screen.getByText('Author').nextElementSibling?.textContent).toBe('Ana and Ben')
    expect(
      screen.getByText('Date Published').nextElementSibling?.querySelector('time'),
    ).not.toBeNull()
    expect(screen.getByText('Transportation').className).toContain('bg-scrim/60')
  })

  it('heads a post without a photo plainly, never white text on the page', () => {
    const props = postHeaderProps({ ...post, heroImage: null, authors: [] })
    expect(props.variant).toBeUndefined()

    render(<PageHeader {...props} />)
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-foreground')
    expect(screen.queryByText('Author')).toBeNull()
    expect(screen.getByText('Transportation').className).toContain('text-primary-strong')
  })

  describe('the source (#483)', () => {
    const legistar = 'https://madison.legistar.com/Calendar.aspx'
    const sourceFact = () => screen.getByText('Source').nextElementSibling

    it('links the source’s name to the original, in a new tab it announces', async () => {
      const source = { name: 'City of Madison', url: legistar }
      const { container } = render(<PageHeader {...postHeaderProps({ ...post, source })} />)

      const link = screen.getByRole('link', { name: /City of Madison/ })
      expect(link.getAttribute('href')).toBe(legistar)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(link.textContent).toContain('opens in a new tab')
      // The facts sit under the photo, so the link keeps the site's link color (#571)
      expect(link.className).not.toContain('text-on-image')
      expect(sourceFact()?.contains(link)).toBe(true)
      // The date stays next to it
      expect(screen.getByText('Date Published')).toBeDefined()
      await expectAccessible(container)
    })

    it('keeps the site’s link color on a header without a photo', async () => {
      const source = { name: 'City of Madison', url: legistar }
      const { container } = render(
        <PageHeader {...postHeaderProps({ ...post, heroImage: null, source })} />,
      )

      expect(screen.getByRole('link').className).toContain('text-primary-strong')
      await expectAccessible(container)
    })

    it('shows a source without a link as text', async () => {
      const source = { name: 'Dane County', url: null }
      const { container } = render(<PageHeader {...postHeaderProps({ ...post, source })} />)

      expect(sourceFact()?.textContent).toBe('Dane County')
      expect(screen.queryByRole('link')).toBeNull()
      await expectAccessible(container)
    })

    it('shows nothing extra for a post without a source', async () => {
      const { container } = render(<PageHeader {...postHeaderProps(post)} />)

      expect(screen.queryByText('Source')).toBeNull()
      expect(screen.queryByRole('link')).toBeNull()
      await expectAccessible(container)
    })
  })
})
