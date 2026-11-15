// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RelatedLinks } from './RelatedLinks'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const items = [
  { href: '/resources/government', label: 'Government' },
  { href: '/resources/safety-health', label: 'Safety and health' },
]

describe('RelatedLinks', () => {
  it('is a navigation named by its title, with one link per item, in order', () => {
    render(<RelatedLinks title="More resources" items={items} />)

    const nav = screen.getByRole('navigation', { name: 'More resources' })
    const links = Array.from(nav.querySelectorAll('a'))

    expect(links.map((link) => link.textContent)).toEqual(['Government', 'Safety and health'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/resources/government',
      '/resources/safety-health',
    ])
  })

  it('shows the title as a heading', () => {
    render(<RelatedLinks title="More resources" items={items} />)

    expect(screen.getByRole('heading', { name: 'More resources' })).toBeTruthy()
  })

  it('lists the links so a screen reader announces how many there are', () => {
    render(<RelatedLinks title="More resources" items={items} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows nothing when there is nothing related', () => {
    const { container } = render(<RelatedLinks title="More resources" items={[]} />)

    expect(container.innerHTML).toBe('')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<RelatedLinks title="More resources" items={items} />)

    await expectAccessible(container)
  })
})
