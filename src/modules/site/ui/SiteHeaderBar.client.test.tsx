// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button, Link } from '@/platform/ui'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

import type { HeaderNavLink } from '../domain/nav'
import { SiteHeaderBar } from './SiteHeaderBar.client'

const links: HeaderNavLink[] = []

beforeEach(() => {
  // jsdom has no matchMedia; the header listens for the desktop breakpoint
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(cleanup)

const renderHeader = () =>
  render(
    <SiteHeaderBar
      links={links}
      accountMenu={<Link href="/account">Bar account</Link>}
      mobileAccountMenu={
        <>
          <Link href="/account">Drawer account</Link>
          <Button>Drawer sign out</Button>
        </>
      }
    />,
  )

describe('SiteHeaderBar', () => {
  it("follows the visitor's light or dark theme: it sets no theme of its own (#201)", () => {
    renderHeader()
    expect(screen.getByRole('banner').hasAttribute('data-theme')).toBe(false)
  })

  it('shows the account menu it is given in the bar, and the mobile one only in the menu', async () => {
    renderHeader()
    expect(screen.getByRole('link', { name: 'Bar account' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Drawer account' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('link', { name: 'Drawer account' })).toBeTruthy()
  })

  it.each([
    ['link', 'Drawer account'],
    ['button', 'Drawer sign out'],
  ] as const)('closes the mobile menu when an account %s is used', async (role, name) => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    await userEvent.click(screen.getByRole(role, { name }))

    expect(document.getElementById('mobile-menu')).toBeNull()
  })

  it('opens the menu as a dialog, and Escape closes it and returns focus to the toggle (#437)', async () => {
    renderHeader()
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    await userEvent.click(toggle)

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy()
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(toggle)
  })

  it('closes from its own close button', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("closes its menu at the same width the theme's `lg` starts (#545)", () => {
    // `lg` is 960px so a phone's "desktop site" mode (about 980px) gets the desktop layout; the
    // header repeats the value for matchMedia, so the two must not drift apart
    const css = readFileSync(path.resolve(__dirname, '../../../app/(frontend)/globals.css'), 'utf8')
    const lg = /--breakpoint-lg:\s*([\d.]+rem)/.exec(css)?.[1]
    const queries: string[] = []
    vi.stubGlobal('matchMedia', (query: string) => {
      queries.push(query)
      return { matches: false, addEventListener: () => {}, removeEventListener: () => {} }
    })

    renderHeader()

    expect(lg).toBe('60rem')
    expect(queries).toContain(`(min-width: ${lg})`)
  })
})
