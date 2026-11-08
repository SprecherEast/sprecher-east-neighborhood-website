// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { EventsThisWeekProps } from '../domain/thisWeek'
import type { EventSummary } from '../domain/types'
import { EventsThisWeek } from './EventsThisWeek'

afterEach(cleanup)

const event = (slug: string, title: string, extra: Partial<EventSummary> = {}): EventSummary => ({
  id: slug.length * 10 + title.length,
  slug,
  title,
  date: '2026-10-29T00:00:00.000Z',
  timeStart: null,
  timeEnd: null,
  cancelled: false,
  officialBody: null,
  categories: [],
  description: null,
  locationName: null,
  place: { kind: 'unconfirmed', label: 'Location to be confirmed' },
  image: null,
  ...extra,
})

const props: EventsThisWeekProps = {
  id: 'b1',
  heading: 'This week in Sprecher East',
  allEventsHref: '/events',
  rows: [
    {
      title: 'Coming up',
      events: [event('potluck', 'Fall potluck'), event('cleanup', 'Park cleanup')],
      seeAll: { href: '/events', label: 'See all events' },
    },
    {
      title: 'Civic and official',
      events: [
        event('council', 'Common Council', { officialBody: 'city', cancelled: true }),
        event('county-board', 'County Board', { officialBody: 'county' }),
      ],
      seeAll: { href: '/events', label: 'See all events' },
    },
    {
      title: 'Family',
      events: [event('storytime', 'Library storytime')],
      seeAll: { href: '/events/category/family', label: 'See all Family events' },
    },
  ],
}

const region = (name: string) => screen.getByRole('region', { name })

describe('EventsThisWeek (#122)', () => {
  it('heads the strip, then each row with its own heading and its event cards', async () => {
    const { container } = render(<EventsThisWeek {...props} />)

    expect(screen.getByRole('heading', { level: 2, name: props.heading })).toBeDefined()
    expect(
      screen.getAllByRole('heading', { level: 3 }).map(({ textContent }) => textContent),
    ).toEqual(['Coming up', 'Civic and official', 'Family'])

    const comingUp = within(region('Coming up'))
    expect(comingUp.getAllByRole('listitem')).toHaveLength(2)
    expect(comingUp.getByRole('link', { name: 'Fall potluck' }).getAttribute('href')).toBe(
      '/events/potluck',
    )
    expect(comingUp.getByRole('heading', { level: 4, name: 'Park cleanup' })).toBeDefined()
    expect(container.querySelector('#block-b1')).not.toBeNull()
    await expectAccessible(container)
  })

  it('labels a cancelled official meeting inside its row, in words', () => {
    render(<EventsThisWeek {...props} />)

    const civic = within(region('Civic and official'))
    expect(
      civic.getByRole('link', { name: 'Cancelled, Official meeting: Common Council' }),
    ).toBeDefined()
    expect(civic.getByRole('link', { name: 'Official meeting: County Board' })).toBeDefined()
  })

  it('ends each row with its "See all" link', () => {
    render(<EventsThisWeek {...props} />)

    const seeAll = (row: string) =>
      within(region(row))
        .getByRole('link', { name: /^See all/ })
        .getAttribute('href')
    expect(seeAll('Coming up')).toBe('/events')
    expect(seeAll('Civic and official')).toBe('/events')
    expect(seeAll('Family')).toBe('/events/category/family')
    expect(
      within(region('Family')).getByRole('link', { name: 'See all Family events' }),
    ).toBeDefined()
  })

  it('draws only the rows it is given: an empty row leaves no heading or box behind', () => {
    render(
      <EventsThisWeek
        {...props}
        rows={props.rows.filter(({ title }) => title !== 'Civic and official')}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Civic and official' })).toBeNull()
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.queryByText('Nothing on the calendar this week.')).toBeNull()
  })

  it('shows one calm message with the link to every event when every row is empty', async () => {
    const { container } = render(<EventsThisWeek {...props} rows={[]} />)

    expect(screen.getByRole('heading', { level: 2, name: props.heading })).toBeDefined()
    expect(screen.getByText('Nothing on the calendar this week.')).toBeDefined()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([])
    expect(screen.getByRole('link', { name: 'See all events' }).getAttribute('href')).toBe(
      '/events',
    )
    await expectAccessible(container)
  })
})
