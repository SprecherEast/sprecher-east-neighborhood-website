// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TOUCH_MIN_HEIGHT } from '@/platform/ui/layoutSizes'

vi.mock('../data/globals', () => ({
  getFooter: async () => ({
    navItems: [{ link: { type: 'custom', label: 'Events', url: '/events' } }],
    forumUrl: null,
  }),
}))

import { SiteFooter } from './SiteFooter'

afterEach(cleanup)

describe('SiteFooter (#741)', () => {
  it('names its columns with h2 headings, so the page outline has no skipped level', async () => {
    render(await SiteFooter())

    expect(screen.getByRole('heading', { name: 'Quick Links', level: 2 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Get in Touch', level: 2 })).toBeTruthy()
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })

  it('makes the logo and the links tall enough to tap', async () => {
    render(await SiteFooter())

    for (const link of [
      screen.getByRole('link', { name: /Sprecher\s*East/ }),
      screen.getByRole('link', { name: 'Events' }),
    ]) {
      expect(link.className).toContain(TOUCH_MIN_HEIGHT)
    }
  })

  it('says the site is unofficial, made with AI tools and reviewed by a neighbor, and claims no initiative', async () => {
    render(await SiteFooter())

    expect(
      screen.getByText(
        'This is an unofficial neighborhood site, made with AI tools and reviewed by a neighbor.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/initiative|association/i)).toBeNull()
  })
})
