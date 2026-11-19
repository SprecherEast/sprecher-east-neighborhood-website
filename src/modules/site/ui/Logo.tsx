import clsx from 'clsx'
import NextLink from 'next/link'
import React from 'react'

import { TOUCH_MIN_HEIGHT } from '@/platform/ui/layoutSizes'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { className } = props

  return (
    <span className={clsx('inline-flex items-baseline gap-1.5 text-xl tracking-tight', className)}>
      <span className="font-bold text-primary">Sprecher</span>
      <span className="font-light text-foreground">East</span>
    </span>
  )
}

/**
 * The name as a link to the home page, in the header, the mobile menu and the footer (#741): one
 * place that makes it as tall as a tap needs, 44 px on a phone and 36 px from `lg`.
 */
export const LogoLink = ({
  className,
  logoClassName,
  onClick,
}: {
  className?: string
  logoClassName?: string
  onClick?: () => void
}) => (
  <NextLink
    href="/"
    onClick={onClick}
    className={clsx('inline-flex shrink-0 items-center', TOUCH_MIN_HEIGHT, className)}
  >
    <Logo className={logoClassName} />
  </NextLink>
)
