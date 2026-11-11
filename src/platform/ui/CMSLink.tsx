import React from 'react'

import type { ResolvedLink } from '@/platform/lib'

import { Button } from './Button'

/** The `Button` variant for each look an editor can choose: `default` primary, `outline` secondary, `accent` the orange. */
const VARIANT = {
  default: 'primary',
  outline: 'secondary',
  accent: 'accent',
} as const satisfies Record<ResolvedLink['appearance'], 'primary' | 'secondary' | 'accent'>

/** A resolved CMS link as a `Button` in the look the editor chose. */
export function LinkButton({
  link,
  className,
  children,
}: {
  link: ResolvedLink
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Button
      href={link.href}
      external={link.external}
      variant={VARIANT[link.appearance]}
      className={className}
    >
      {link.label}
      {children}
    </Button>
  )
}
