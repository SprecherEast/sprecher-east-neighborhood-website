'use client'

import React from 'react'

import { Link } from '@/platform/ui'
import { NavMenu } from '@/platform/ui/NavMenu.client'
import { SearchIcon } from 'lucide-react'

import { type HeaderNavLink, isActivePath } from '../domain/nav'

interface HeaderNavProps {
  links: HeaderNavLink[]
  pathname: string
  mobile?: boolean
  onNavigate?: () => void
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ links, pathname, mobile, onNavigate }) => {
  const size = mobile ? 'md' : 'sm'

  return (
    <nav aria-label="Main" className={mobile ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
      {links.map((link, i) =>
        link.children ? (
          <NavMenu
            key={i}
            label={link.label}
            layout={mobile ? 'stacked' : 'dropdown'}
            items={link.children.map((child) => ({
              ...child,
              current: isActivePath(pathname, child.href),
            }))}
            onNavigate={onNavigate}
          />
        ) : (
          <Link
            key={i}
            href={link.href}
            external={link.external}
            variant="nav"
            size={size}
            current={isActivePath(pathname, link.href)}
            className={mobile ? undefined : 'compact:px-2'}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        ),
      )}
      <Link
        href="/search"
        variant="nav"
        size={size}
        current={isActivePath(pathname, '/search')}
        icon={<SearchIcon aria-hidden="true" />}
        // In the desktop bar only the magnifier shows, muted until it's the current page
        iconOnly={!mobile}
        className={mobile ? undefined : 'text-muted-foreground compact:px-2'}
        onClick={onNavigate}
      >
        Search
      </Link>
    </nav>
  )
}
