'use client'

import { ChevronDown } from 'lucide-react'
import React, { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/platform/lib/cn'

import { Link, linkVariants } from './Link'

export type NavMenuItem = {
  href: string
  label: string
  external?: boolean
  /** This link is the page being shown */
  current?: boolean
}

/**
 * A menu item of the header that opens to more links when pressed, never on hover (#1237). It is a
 * native `<details>`: the label is its button, so it opens and closes with Enter and Space and
 * tells assistive tech which it is. Pressing outside it, pressing Escape (focus returns to the
 * label), moving focus out of it and following a link all close it.
 *
 * `dropdown` is the desktop bar's: the links sit in a panel under the label. `stacked` is the
 * mobile menu's: a full-width row that opens to an indented list, an accordion.
 */
export function NavMenu({
  label,
  items,
  layout = 'dropdown',
  onNavigate,
  className,
}: {
  label: string
  items: readonly NavMenuItem[]
  layout?: 'dropdown' | 'stacked'
  /** Called when one of the links is followed, for example to close the mobile menu around it */
  onNavigate?: () => void
  className?: string
}) {
  const box = useRef<HTMLDetailsElement>(null)
  const stacked = layout === 'stacked'
  const containsCurrent = items.some(({ current }) => current)

  const close = useCallback(() => {
    box.current?.removeAttribute('open')
  }, [])

  // A press anywhere outside closes it; a listener only while it is open
  useEffect(() => {
    const element = box.current
    if (!element) return
    const onPress = (event: Event) => {
      if (element.open && event.target instanceof Node && !element.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [close])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape' || !box.current?.open) return
    close()
    box.current.querySelector('summary')?.focus()
  }

  const onBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget
    if (next instanceof Node && !box.current?.contains(next)) close()
  }

  return (
    <details ref={box} className={cn('relative', className)} onKeyDown={onKeyDown} onBlur={onBlur}>
      <summary
        data-current={containsCurrent}
        className={cn(
          linkVariants({ variant: 'nav', size: stacked ? 'md' : 'sm' }),
          'cursor-pointer list-none justify-between [&::-webkit-details-marker]:hidden',
          'data-[current=true]:text-primary-strong',
          !stacked && 'compact:px-2',
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className="transition-transform duration-200 [details[open]>summary_&]:rotate-180"
        />
      </summary>
      <ul
        className={cn(
          'nav-menu-slide',
          stacked
            ? 'ml-3 border-l border-border pl-2'
            : 'absolute top-full left-0 z-50 mt-2 min-w-60 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg',
        )}
      >
        {items.map(({ href, label: text, external, current }) => (
          <li key={href}>
            <Link
              href={href}
              external={external}
              variant="nav"
              size="md"
              current={current}
              onClick={() => {
                close()
                onNavigate?.()
              }}
            >
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
