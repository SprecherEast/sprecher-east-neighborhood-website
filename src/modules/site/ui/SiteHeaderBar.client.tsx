'use client'
import { usePathname } from 'next/navigation'
import React, { type ReactNode, useCallback, useEffect, useState } from 'react'

import { Button } from '@/platform/ui'
import { Dialog } from '@/platform/ui/Dialog.client'
import { Menu } from 'lucide-react'
import { LogoLink } from './Logo'
import type { HeaderNavLink } from '../domain/nav'
import { HeaderNav } from './HeaderNav.client'

interface SiteHeaderBarProps {
  /** The nav links the editors set, already resolved */
  links: HeaderNavLink[]
  /** The account links in the desktop bar */
  accountMenu: ReactNode
  /** The account links in the mobile menu */
  mobileAccountMenu: ReactNode
}

export const SiteHeaderBar: React.FC<SiteHeaderBarProps> = ({
  links,
  accountMenu,
  mobileAccountMenu,
}) => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const closeMobileMenu = useCallback(() => setMobileOpen(false), [])

  const closeOnLinkOrButton = useCallback(
    (event: React.MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a, button')) closeMobileMenu()
    },
    [closeMobileMenu],
  )

  // A new page closes the mobile menu
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu if the viewport grows past the desktop breakpoint (e.g. a tablet
  // rotated with the menu open): its close button hides there, and the scroll lock would stay
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 60rem)') // Tailwind's lg (globals.css), in rem so it tracks font size
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false)
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-200 ${
        scrolled ? 'shadow-md' : 'shadow-sm'
      }`}
    >
      <div className="container flex items-center justify-between py-4 compact:px-4!">
        <LogoLink />

        {/* Desktop nav */}
        {/* Desktop nav starts at lg (960px): below it the items don't fit and the page scrolls sideways.
            In the compact band (960 to 1023px) the bar is tighter (side padding, link padding, the
            Contact gap and the account name), so a signed-in header still fits a phone's desktop
            mode, about 980px (#545) */}
        <div className="hidden items-center gap-1 lg:flex">
          <HeaderNav links={links} pathname={pathname} />
          {accountMenu}
          <Button
            href="/contact"
            size="sm"
            aria-current={pathname === '/contact' ? 'page' : undefined}
            className="ml-3 compact:ml-2"
          >
            Contact
          </Button>
        </div>

        {/* The mobile menu: a full-screen sheet, with Radix's focus trap, Escape, scroll lock and
            focus return (#437) */}
        <Dialog
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          title="Menu"
          hideTitle
          closeLabel="Close menu"
          start={<LogoLink onClick={closeMobileMenu} />}
          className="lg:hidden"
          trigger={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu aria-hidden="true" />
            </Button>
          }
        >
          <div id="mobile-menu" className="container flex flex-col gap-2 py-4">
            <HeaderNav links={links} pathname={pathname} mobile onNavigate={closeMobileMenu} />
            {/* Following a link or signing out in the account links closes the menu too */}
            <div className="contents" onClick={closeOnLinkOrButton}>
              {mobileAccountMenu}
            </div>
            <Button
              href="/contact"
              fullWidth
              onClick={closeMobileMenu}
              aria-current={pathname === '/contact' ? 'page' : undefined}
              className="mt-2"
            >
              Contact
            </Button>
          </div>
        </Dialog>
      </div>
    </header>
  )
}
