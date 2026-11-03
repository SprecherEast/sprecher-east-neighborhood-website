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
})
