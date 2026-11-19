// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { Steps } from './Steps'

afterEach(cleanup)

describe('Steps', () => {
  it('lists the steps in order as headings, numbered, with no accessibility violations', async () => {
    const { container } = render(
      <Steps
        steps={[
          { heading: 'Join the meeting', body: 'Ask for dates.', link: null },
          {
            heading: 'Tell your alder',
            body: null,
            link: {
              href: '/council',
              label: 'Find your alder',
              external: false,
              appearance: 'default',
            },
          },
          { heading: 'Vote on noise walls', body: null, link: null },
        ]}
      />,
    )

    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    // Screen readers hear the number with the heading; the circle is decoration
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Step 1: Join the meeting',
      'Step 2: Tell your alder',
      'Step 3: Vote on noise walls',
    ])
    expect(screen.getByRole('list').getAttribute('role')).toBe('list')
    expect(
      items.map((item) => item.querySelector('[aria-hidden="true"].rounded-full')?.textContent),
    ).toEqual(['1', '2', '3'])
    expect(screen.getByRole('link', { name: /Find your alder/ }).getAttribute('href')).toBe(
      '/council',
    )
    // A line joins each step to the next, none after the last
    expect(container.querySelectorAll('li > span.border-l-2')).toHaveLength(2)
    await expectAccessible(container)
  })

  it('renders nothing without steps', () => {
    const { container } = render(<Steps steps={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
