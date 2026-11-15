// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { HeaderNavLink } from '../domain/nav'
import { HeaderNav } from './HeaderNav.client'

afterEach(cleanup)

const links: HeaderNavLink[] = [
  { href: '/events', label: 'Events', external: false },
  { href: '/posts', label: 'News', external: false },
]

const linkNames = () => screen.getAllByRole('link').map((link) => link.textContent)

describe('HeaderNav', () => {
  it('shows the editors’ links, then Search', () => {
    render(<HeaderNav links={links} pathname="/" mobile />)

    expect(linkNames()).toEqual(['Events', 'News', 'Search'])
  })

  it('opens an external link in a new tab', () => {
    render(
      <HeaderNav
        links={[{ href: 'https://city.test', label: 'City', external: true }]}
        pathname="/"
        mobile
      />,
    )

    expect(screen.getByRole('link', { name: /City/ }).getAttribute('target')).toBe('_blank')
  })

  it('marks the link for the section the visitor is in', () => {
    render(<HeaderNav links={links} pathname="/posts/park-cleanup" mobile />)

    expect(screen.getByRole('link', { name: 'News' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Events' }).getAttribute('aria-current')).toBeNull()
  })

  describe('an item with a submenu', () => {
    const resources: HeaderNavLink = {
      href: '/resources',
      label: 'Resources',
      external: false,
      children: [
        { href: '/resources/utilities', label: 'Neighborhood utilities', external: false },
        { href: '/resources/government', label: 'Government', external: false },
      ],
    }

    it('is a menu opened by pressing its label, not a link of its own', () => {
      const { container } = render(<HeaderNav links={[links[0], resources]} pathname="/" />)

      expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull()
      expect(container.querySelector('details summary')?.textContent).toBe('Resources')
      expect(linkNames()).toEqual(['Events', 'Neighborhood utilities', 'Government', 'Search'])
    })

    it('marks the submenu link for the page being read, and the menu', () => {
      const { container } = render(
        <HeaderNav links={[resources]} pathname="/resources/government" />,
      )

      expect(screen.getByRole('link', { name: 'Government' }).getAttribute('aria-current')).toBe(
        'page',
      )
      expect(container.querySelector('summary')?.getAttribute('data-current')).toBe('true')
    })

    it('is an accordion in the mobile menu', () => {
      const { container } = render(<HeaderNav links={[resources]} pathname="/" mobile />)

      expect(container.querySelector('details ul')?.className).toContain('border-l')
    })
  })
})
