// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    it('is a menu opened by pressing its label, not a link of its own', async () => {
      render(<HeaderNav links={[links[0], resources]} pathname="/" />)

      expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull()
      expect(linkNames()).toEqual(['Events', 'Search'])

      await userEvent.click(screen.getByRole('button', { name: 'Resources' }))
      // The popover places its panel at the end of the page
      expect(linkNames()).toEqual(['Events', 'Search', 'Neighborhood utilities', 'Government'])
    })

    it('marks the submenu link for the page being read, and the menu', async () => {
      render(<HeaderNav links={[resources]} pathname="/resources/government" />)
      const button = screen.getByRole('button', { name: 'Resources' })

      expect(button.getAttribute('data-current')).toBe('true')
      await userEvent.click(button)
      expect(screen.getByRole('link', { name: 'Government' }).getAttribute('aria-current')).toBe(
        'page',
      )
    })

    it('is an accordion in the mobile menu', () => {
      const { container } = render(<HeaderNav links={[resources]} pathname="/" mobile />)

      expect(container.querySelector('details summary')?.textContent).toBe('Resources')
      expect(linkNames()).toEqual(['Neighborhood utilities', 'Government', 'Search'])
    })
  })
})
