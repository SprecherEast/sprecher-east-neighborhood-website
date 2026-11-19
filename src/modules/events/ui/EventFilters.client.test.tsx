// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const segments = vi.hoisted(() => ({ value: [] as string[] }))
vi.mock('next/navigation', () => ({ useSelectedLayoutSegments: () => segments.value }))
vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))

import type { EventFilterMenu } from '../domain/filters'
import { EventFilters } from './EventFilters.client'

const MENU: EventFilterMenu = {
  all: { upcoming: 8, past: 12 },
  categories: [
    { id: 3, slug: 'civic', title: 'Civic', counts: { upcoming: 4, past: 5 } },
    { id: 7, slug: 'parks', title: 'Parks', counts: { upcoming: 1, past: 0 } },
  ],
}

afterEach(() => {
  cleanup()
  segments.value = []
})

const links = () => within(screen.getByRole('navigation', { name: 'Event categories' }))

describe('EventFilters', () => {
  it('links every category, after "All", as plain links that work without JavaScript', () => {
    render(<EventFilters menu={MENU} />)

    expect(
      links()
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['All', '/events'],
      ['Civic', '/events/category/civic'],
      ['Parks', '/events/category/parks'],
    ])
  })

  it('marks "All" as current on /events and says how many events there are', () => {
    render(<EventFilters menu={MENU} />)

    expect(links().getByRole('link', { name: 'All' }).getAttribute('aria-current')).toBe('page')
    expect(links().getByRole('link', { name: 'Civic' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe(
      'Showing all 20 events: 8 upcoming and 12 past',
    )
  })

  it("marks a category's page as current and announces its count", () => {
    segments.value = ['category', 'civic']
    render(<EventFilters menu={MENU} />)

    expect(links().getByRole('link', { name: 'Civic' }).getAttribute('aria-current')).toBe('page')
    expect(links().getByRole('link', { name: 'All' }).getAttribute('aria-current')).toBeNull()
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('Showing 9 Civic events: 4 upcoming and 5 past')
  })

  it('draws nothing when no event has a category', () => {
    const { container } = render(<EventFilters menu={{ all: MENU.all, categories: [] }} />)
    expect(container.innerHTML).toBe('')
  })

  it('is accessible', async () => {
    segments.value = ['category', 'parks']
    const { container } = render(<EventFilters menu={MENU} />)
    await expectAccessible(container)
  })
})
