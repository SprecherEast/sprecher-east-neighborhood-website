import { describe, expect, it } from 'vitest'

import { resolveLink } from './resolveLink'

describe('resolveLink', () => {
  it('links a referenced page by its slug', () => {
    expect(
      resolveLink({
        type: 'reference',
        label: 'About',
        reference: { relationTo: 'pages', value: { slug: 'about' } },
      }),
    ).toEqual({ href: '/about', label: 'About', external: false, appearance: 'default' })
  })

  it('prefixes a referenced post with its collection', () => {
    expect(
      resolveLink({
        type: 'reference',
        label: 'Read',
        reference: { relationTo: 'posts', value: { slug: 'hello' } },
      })?.href,
    ).toBe('/posts/hello')
  })

  it('uses the custom URL and opens it in a new tab when asked', () => {
    expect(
      resolveLink({ type: 'custom', url: '/events', label: 'Events', newTab: true }),
    ).toMatchObject({
      href: '/events',
      external: true,
    })
  })

  it('links the home page to /', () => {
    expect(
      resolveLink({
        type: 'reference',
        label: 'Home',
        reference: { relationTo: 'pages', value: { slug: 'home' } },
      })?.href,
    ).toBe('/')
  })

  it('keeps the CMS appearance, defaulting to default', () => {
    expect(
      resolveLink({ type: 'custom', url: '/a', label: 'A', appearance: 'outline' })?.appearance,
    ).toBe('outline')
    expect(resolveLink({ type: 'custom', url: '/a', label: 'A' })?.appearance).toBe('default')
  })

  it('keeps the accent appearance, the orange button', () => {
    expect(
      resolveLink({ type: 'custom', url: '/a', label: 'A', appearance: 'accent' })?.appearance,
    ).toBe('accent')
  })

  it('returns null when the reference is unpopulated or has no slug, or there is no URL', () => {
    expect(
      resolveLink({ type: 'reference', label: 'X', reference: { relationTo: 'pages', value: 3 } }),
    ).toBeNull()
    expect(
      resolveLink({
        type: 'reference',
        label: 'X',
        reference: { relationTo: 'pages', value: { slug: null } },
      }),
    ).toBeNull()
    expect(
      resolveLink({
        type: 'reference',
        label: 'X',
        reference: { relationTo: 'pages', value: null as never },
      }),
    ).toBeNull()
    expect(resolveLink({ type: 'custom', url: '', label: 'X' })).toBeNull()
    expect(resolveLink(null)).toBeNull()
  })
})
