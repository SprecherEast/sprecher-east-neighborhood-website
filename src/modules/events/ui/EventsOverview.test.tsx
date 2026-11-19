// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FeedPage } from '@/platform/lib'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

// The feeds load more through a server action; this tests what the page says around them
vi.mock('./EventsFeed.client', () => ({
  EventsFeed: ({ scope }: { scope: string }) => <p>{scope} feed</p>,
}))

import type { EventSummary } from '../domain/types'
import { EventsOverview } from './EventsOverview'

afterEach(cleanup)

const listOf = (totalDocs: number): FeedPage<EventSummary> => ({
  docs: [],
  page: 1,
  totalPages: totalDocs > 0 ? 1 : 0,
  totalDocs,
  limit: 12,
  nextCursor: null,
})

describe('the events overview with no upcoming events', () => {
  it('points to past events when there are some', () => {
    render(<EventsOverview upcoming={listOf(0)} past={listOf(3)} />)

    expect(screen.getByText('No upcoming events are posted right now.')).toBeTruthy()
    expect(screen.getByText(/browse past events below/)).toBeTruthy()
    expect(screen.getByText('past feed')).toBeTruthy()
  })

  it("doesn't point to past events that aren't there (#206)", () => {
    render(<EventsOverview upcoming={listOf(0)} past={listOf(0)} />)

    expect(screen.getByText('No upcoming events are posted right now.')).toBeTruthy()
    expect(screen.queryByText(/past events/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Past Events' })).toBeNull()
  })

  it('names the category filtered on (#122)', async () => {
    const { container } = render(
      <EventsOverview
        upcoming={listOf(0)}
        past={listOf(2)}
        category={{ slug: 'civic', title: 'Civic' }}
      />,
    )

    expect(screen.getByText('No upcoming Civic events are posted right now.')).toBeTruthy()
    await expectAccessible(container)
  })
})
