import React from 'react'

import { cn } from '@/platform/lib/cn'

import { SignedChange, type SignedChangeProps } from './SignedChange'
import { Text } from './Text'

export type ChangeFigureProps = {
  /** What the figure is, such as "2027 adopted" */
  label: string
  /** The figure, already written: "$477.7M" */
  value: string
  change: Omit<SignedChangeProps, 'className'> & {
    /** What it changed from, such as "2026 adopted" */
    since: string
  }
  className?: string
}

/**
 * One big figure and how it changed (#1503): the label, the figure, then the signed change
 * (`SignedChange`) and what it is measured from. The change is neutral on purpose: more or less
 * money is not good or bad by itself.
 */
export function ChangeFigure({ label, value, change, className }: ChangeFigureProps) {
  const { since, ...signed } = change
  return (
    <div data-change-figure="" className={cn('space-y-2', className)}>
      <Text variant="small" as="p">
        {label}
      </Text>
      <Text variant="figure" as="p">
        {value}
      </Text>
      <p className="text-base leading-snug text-foreground">
        <SignedChange {...signed} className="text-base" />{' '}
        <span className="text-muted-foreground">from {since}</span>
      </p>
    </div>
  )
}
