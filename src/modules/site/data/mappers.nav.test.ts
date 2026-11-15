import { describe, expect, it } from 'vitest'

import type { Header } from '@/payload-types'

import { toHeaderNavLinks } from './mappers'

describe('toHeaderNavLinks', () => {
  const item = (label: string, url: string, newTab = false) => ({
    link: { type: 'custom' as const, label, url, newTab },
  })
  const header = (...navItems: NonNullable<Header['navItems']>): Header => ({ id: 1, navItems })

  it('turns the editors’ nav items into plain links, in order', () => {
    expect(toHeaderNavLinks(header(item('Events', '/events'), item('City', 'https://x.test', true)))).toEqual([
      { href: '/events', label: 'Events', external: false },
      { href: 'https://x.test', label: 'City', external: true },
    ])
  })

  it('resolves a link to a page by its address', () => {
    const page = {
      link: {
        type: 'reference' as const,
        label: 'About',
        reference: { relationTo: 'pages' as const, value: { id: 2, slug: 'about' } as never },
      },
    }

    expect(toHeaderNavLinks(header(page))).toEqual([
      { href: '/about', label: 'About', external: false },
    ])
  })

  it('leaves out a Contact link, which the header shows as its own button', () => {
    expect(toHeaderNavLinks(header(item('Events', '/events'), item('Contact', '/contact')))).toHaveLength(1)
  })

  it('keeps an item’s submenu links as its children, in order, dropping ones that go nowhere', () => {
    const gone = { link: { type: 'reference' as const, label: 'Gone', reference: null } }
    const menu = {
      ...item('Resources', '/resources'),
      subItems: [item('Utilities', '/resources/utilities'), gone, item('City', 'https://x.test', true)],
    }

    expect(toHeaderNavLinks(header(menu))).toEqual([
      {
        href: '/resources',
        label: 'Resources',
        external: false,
        children: [
          { href: '/resources/utilities', label: 'Utilities', external: false },
          { href: 'https://x.test', label: 'City', external: true },
        ],
      },
    ])
  })

  it('leaves an item with no usable submenu links a plain link', () => {
    const gone = { link: { type: 'reference' as const, label: 'Gone', reference: null } }

    expect(toHeaderNavLinks(header({ ...item('Resources', '/resources'), subItems: [gone] }))).toEqual([
      { href: '/resources', label: 'Resources', external: false },
    ])
  })

  it('leaves out a link that goes nowhere, and copes with no nav items', () => {
    const gone = { link: { type: 'reference' as const, label: 'Gone', reference: null } }

    expect(toHeaderNavLinks(header(gone))).toEqual([])
    expect(toHeaderNavLinks({})).toEqual([])
  })
})
