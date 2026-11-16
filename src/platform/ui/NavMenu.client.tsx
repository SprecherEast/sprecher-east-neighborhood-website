'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Disclosure } from './Disclosure'
import { Link, linkVariants } from './Link'

export type NavMenuItem = {
  href: string
  label: string
  external?: boolean
  /** This link is the page being shown */
  current?: boolean
}

type NavMenuProps = {
  label: string
  items: readonly NavMenuItem[]
  /** `dropdown` is the wide bar's panel under the label; `stacked` is the mobile menu's accordion */
  layout?: 'dropdown' | 'stacked'
  /** Called when one of the links is followed, for example to close the mobile menu around it */
  onNavigate?: () => void
}

/**
 * A menu item of the header that opens to more links when pressed, never on hover (#1237). It adds
 * no behavior of its own: the wide bar's panel is Radix's popover (it closes on Escape, a press
 * outside, and a followed link) and the mobile menu's accordion is the kit's `Disclosure`, whose
 * links are plain links like every other link of that menu.
 */
export function NavMenu({ label, items, layout = 'dropdown', onNavigate }: NavMenuProps) {
  if (layout === 'stacked') {
    return (
      <Disclosure variant="nav" summary={label}>
        <ul>
          {items.map((item) => (
            <li key={`${item.href}|${item.label}`}>
              <Link
                href={item.href}
                external={item.external}
                variant="nav"
                size="md"
                current={item.current}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Disclosure>
    )
  }

  return <NavMenuDropdown label={label} items={items} onNavigate={onNavigate} />
}

function NavMenuDropdown({ label, items, onNavigate }: Omit<NavMenuProps, 'layout'>) {
  const containsCurrent = items.some(({ current }) => current)

  return (
    <Popover.Root>
      <Popover.Trigger
        data-current={containsCurrent}
        className={cn(
          linkVariants({ variant: 'nav', size: 'sm' }),
          'cursor-pointer data-[current=true]:text-primary-strong compact:px-2',
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className="transition-transform duration-200 [[aria-expanded=true]>&]:rotate-180"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          align="start"
          sideOffset={8}
          className="z-50 min-w-60 nav-menu-slide rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <ul>
            {items.map((item) => (
              <li key={`${item.href}|${item.label}`}>
                <Popover.Close asChild>
                  <Link
                    href={item.href}
                    external={item.external}
                    variant="nav"
                    size="md"
                    current={item.current}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
