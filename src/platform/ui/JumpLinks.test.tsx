// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { JumpLinks } from './JumpLinks'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const items = [
  { id: 'utilities', label: 'Neighborhood utilities' },
  { id: 'government', label: 'Government' },
]

describe('JumpLinks', () => {
  it('is a named navigation with one link per item, in order, to its id', () => {
    render(<JumpLinks label="Resource groups" items={items} />)

    const nav = screen.getByRole('navigation', { name: 'Resource groups' })
    const links = Array.from(nav.querySelectorAll('a'))

    expect(links.map((link) => link.textContent)).toEqual(['Neighborhood utilities', 'Government'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#utilities', '#government'])
  })

  it('lists the links so a screen reader announces how many there are', () => {
    render(<JumpLinks label="Resource groups" items={items} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows nothing when there is nothing to jump to', () => {
    const { container } = render(<JumpLinks label="Resource groups" items={[]} />)

    expect(container.innerHTML).toBe('')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<JumpLinks label="Resource groups" items={items} />)

    await expectAccessible(container)
  })
})
