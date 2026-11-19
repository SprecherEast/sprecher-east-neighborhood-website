// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { Timeline } from './Timeline'
import type { TimelineEntry } from './timeline'

afterEach(cleanup)

const entry = (overrides: Partial<TimelineEntry>): TimelineEntry => ({
  date: '2026',
  title: 'A milestone',
  description: null,
  status: 'later',
  link: null,
  ...overrides,
})

const ENTRIES: TimelineEntry[] = [
  entry({ date: 'Dec 5, 2024', title: 'Corridor decision', status: 'done' }),
  entry({
    date: 'Nov 10, 2026',
    title: 'Public meeting',
    status: 'next',
    description: 'Ask about the local schedule.',
    link: {
      href: 'https://example.com/meeting',
      label: 'Register',
      external: true,
      appearance: 'default',
    },
  }),
  entry({ date: 'Not set', title: 'City and State cost deal', status: 'conditional' }),
  entry({ date: 'Early 2040s', title: 'Construction', status: 'later' }),
]

describe('Timeline', () => {
  it('lists milestones in order, each with its date, title and status in words', async () => {
    const { container } = render(<Timeline entries={ENTRIES} />)

    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Corridor decision',
      'Public meeting',
      'City and State cost deal',
      'Construction',
    ])
    expect(items[0].textContent).toContain('Dec 5, 2024')
    expect(within(items[0]).getByText('Done')).toBeTruthy()
    expect(within(items[1]).getByText('Next up')).toBeTruthy()
    expect(within(items[2]).getByText('Depends')).toBeTruthy()
    expect(within(items[3]).getByText('Later')).toBeTruthy()
    await expectAccessible(container)
  })

  it('marks the next milestone as the current step', () => {
    render(<Timeline entries={ENTRIES} />)

    const current = screen
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toContain('Public meeting')
  })

  it('marks only the first "Next up" as the current step if an editor marked two', () => {
    render(
      <Timeline
        entries={[
          entry({ title: 'First', status: 'next' }),
          entry({ title: 'Second', status: 'next' }),
        ]}
      />,
    )

    const current = screen
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'step')
    expect(current.map((item) => item.textContent)).toEqual([expect.stringContaining('First')])
  })

  it('shows a description and a link when the milestone has them', () => {
    render(<Timeline entries={ENTRIES} />)

    expect(screen.getByText('Ask about the local schedule.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Register/ }).getAttribute('href')).toBe(
      'https://example.com/meeting',
    )
  })

  it('draws the line solid up to a reached milestone and dashed ahead, with no line after the last', () => {
    const { container } = render(
      <Timeline
        entries={[entry({ status: 'done' }), entry({ status: 'done' }), entry({ status: 'next' })]}
      />,
    )

    const lines = Array.from(container.querySelectorAll('li > span.border-l-2'))
    expect(lines).toHaveLength(2)
    expect(lines[0].className).not.toContain('border-dashed')
    expect(lines[1].className).toContain('border-dashed')
  })

  it('renders nothing without milestones', () => {
    const { container } = render(<Timeline entries={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
