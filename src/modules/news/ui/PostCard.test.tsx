// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PostSummary } from '../domain/types'
import { PostCard } from './PostCard'

afterEach(cleanup)

const post: PostSummary = {
  id: 7,
  slug: 'council-recap',
  href: '/posts/council-recap',
  title: 'Council recap',
  publishedAt: '2026-10-01T12:00:00.000Z',
  categories: [{ id: 1, title: 'City council' }],
  description: 'What the council decided.',
  image: null,
  source: null,
}

describe('PostCard source line (#483)', () => {
  it('names the source as text, keeping the card’s one link', async () => {
    const source = { name: 'City of Madison', url: 'https://madison.legistar.com/Calendar.aspx' }
    const { container } = render(<PostCard post={{ ...post, source }} />)

    expect(screen.getByText('Source: City of Madison').tagName).toBe('P')
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe('/posts/council-recap')
    expect(container.querySelector('a a')).toBeNull()
    await expectAccessible(container)
  })

  it('shows no source line for a post without a source', async () => {
    const { container } = render(<PostCard post={post} />)

    expect(screen.queryByText(/^Source:/)).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    await expectAccessible(container)
  })
})

describe('PostCard Cancelled label (#471)', () => {
  it('marks a cancelled event in search results inside its title link', async () => {
    const event = { ...post, href: '/events/plan-commission', title: 'Plan Commission' }
    const { container } = render(
      <PostCard post={{ ...event, cancelled: true }} headingLevel="h2" />,
    )

    expect(screen.getByRole('link', { name: 'Cancelled: Plan Commission' })).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    await expectAccessible(container)
  })

  it('shows no label otherwise', () => {
    render(<PostCard post={post} />)

    expect(screen.queryByText('Cancelled')).toBeNull()
    expect(screen.getByRole('link', { name: 'Council recap' })).toBeTruthy()
  })
})
