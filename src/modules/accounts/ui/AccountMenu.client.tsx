'use client'

import { usePathname } from 'next/navigation'
import React from 'react'

import { ADMIN_ROUTE } from '@/platform/payload/adminRoutes'
import { Button, Link } from '@/platform/ui'

import { ACCOUNT_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from '../domain/paths'
import { useAccount } from './AccountProvider.client'

/**
 * The header's account links: "Log In" and "Sign Up" for a visitor (#296); the account's name
 * and "Sign Out" when signed in. The mobile menu also has "Dashboard" (the admin) for an admin or
 * editor (#378), as the admin bar is hidden on phones; on desktop the admin bar has it, and one
 * more link in the bar would overflow it at 960 px (#383). `bar` is the desktop header,
 * `drawer` the mobile menu.
 */
export function AccountMenu({ variant }: { variant: 'bar' | 'drawer' }) {
  const { account, loading, signOut } = useAccount()
  const pathname = usePathname()
  const bar = variant === 'bar'

  const visitorLinks = (
    <>
      <Link
        href={SIGN_IN_PATH}
        variant="nav"
        size={bar ? 'sm' : undefined}
        current={pathname === SIGN_IN_PATH}
      >
        Log In
      </Link>
      {/* Outlined in the bar, so it stands out without competing with the Contact button */}
      {bar ? (
        <Button
          href={SIGN_UP_PATH}
          variant="secondary"
          size="sm"
          aria-current={pathname === SIGN_UP_PATH ? 'page' : undefined}
          className="ml-2"
        >
          Sign Up
        </Button>
      ) : (
        <Link href={SIGN_UP_PATH} variant="nav" current={pathname === SIGN_UP_PATH}>
          Sign Up
        </Link>
      )}
    </>
  )

  if (loading) {
    // While the server answers, the bar holds the room the visitor links take (the common case),
    // invisible and out of the tab order and the accessibility tree, so the header doesn't shift
    // when they appear (#281). The mobile menu shows nothing.
    return bar ? (
      <div aria-hidden="true" className="invisible contents">
        {visitorLinks}
      </div>
    ) : null
  }

  if (!account) return visitorLinks

  const label = account.name || 'Account'
  return bar ? (
    <>
      {/* A long name is cut short so the bar never overflows; the full name is the title */}
      <Link
        href={ACCOUNT_PATH}
        variant="nav"
        size="sm"
        current={pathname === ACCOUNT_PATH}
        title={account.name || undefined}
        className="max-w-40 compact:max-w-28 compact:px-2"
      >
        <span className="truncate">{label}</span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="whitespace-nowrap compact:px-2"
      >
        Sign Out
      </Button>
    </>
  ) : (
    <>
      <Link href={ACCOUNT_PATH} variant="nav" current={pathname === ACCOUNT_PATH}>
        {label}
      </Link>
      {account.staff ? (
        <Link href={ADMIN_ROUTE} variant="nav">
          Dashboard
        </Link>
      ) : null}
      <Button
        variant="ghost"
        fullWidth
        onClick={signOut}
        className="justify-start rounded-md px-3 font-medium hover:bg-secondary hover:text-primary"
      >
        Sign Out
      </Button>
    </>
  )
}
