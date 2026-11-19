// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { TopIssuesBlockProps } from '../domain/topIssues'
import { TopIssuesBlock } from './TopIssuesBlock'

afterEach(cleanup)

const props: TopIssuesBlockProps = {
  id: 'b1',
  heading: 'Top issues right now',
  reviewedAt: '2026-10-26T00:00:00.000Z',
  items: [
    {
      title: 'Road work on Sprecher Road',
      summary: 'What the city has planned, and when.',
      link: { href: '/posts/road-work', external: false },
    },
    { title: 'Get involved', summary: null, link: { href: '/get-involved', external: false } },
    {
      title: 'Talk it over on the forum',
      summary: 'Residents’ questions and answers.',
      link: { href: 'https://discourse.sprechereast.org', external: true },
    },
  ],
}

describe('TopIssuesBlock (#484)', () => {
  it('heads the block and lists each issue in order, its title the link', async () => {
    const { container } = render(<TopIssuesBlock {...props} />)

    const region = screen.getByRole('region', { name: 'Top issues right now' })
    expect(within(region).getByRole('heading', { level: 2 }).textContent).toBe(props.heading)
    const list = within(region).getByRole('list')
    expect(list.tagName).toBe('OL')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(
      items.map((li) => {
        const link = within(li).getByRole('link')
        return [link.textContent, link.getAttribute('href')]
      }),
    ).toEqual([
      ['Road work on Sprecher Road', '/posts/road-work'],
      ['Get involved', '/get-involved'],
      ['Talk it over on the forum, opens in a new tab', 'https://discourse.sprechereast.org'],
    ])
    expect(within(items[0]).getByText('What the city has planned, and when.')).toBeDefined()
    expect(container.querySelector('#block-b1')).not.toBeNull()
    await expectAccessible(container)
  })

  it('opens an external link in a new tab and says so; site links stay in the tab', () => {
    render(<TopIssuesBlock {...props} />)

    const forum = screen.getByRole('link', {
      name: 'Talk it over on the forum, opens in a new tab',
    })
    expect(forum.getAttribute('target')).toBe('_blank')
    expect(forum.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Get involved' }).getAttribute('target')).toBeNull()
  })

  it('shows the day the list was last reviewed, as a calendar date', () => {
    const { container } = render(<TopIssuesBlock {...props} />)

    expect(screen.getByText(/^Updated/).textContent).toBe('Updated Mon, Oct 26, 2026')
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-26')
  })

  it('shows no date when the editor set none', () => {
    const { container } = render(<TopIssuesBlock {...props} reviewedAt={null} />)

    expect(screen.queryByText(/Updated/)).toBeNull()
    expect(container.querySelector('time')).toBeNull()
  })

  it('draws nothing at all when no issue is left', () => {
    const { container } = render(<TopIssuesBlock {...props} items={[]} />)

    expect(container.innerHTML).toBe('')
  })
})
