import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Button } from './Button'
import { Text } from './Text'

/** A direction that cannot go on stays focusable (`aria-disabled`, not `disabled`), so keyboard focus isn't lost when a press reaches the end */
const STOPPED = 'cursor-not-allowed opacity-60'

/*
 * A title with a button on each side to step to the period before and the one after it, such as
 * the month a calendar shows. It holds no state: the caller says what the title is, which way can
 * still go, and what a press does. The title is announced when it changes.
 */
export type PeriodNavProps = {
  title: string
  /** What assistive technology calls each button, such as "Earlier month" */
  previousLabel: string
  nextLabel: string
  onPrevious: () => void
  onNext: () => void
  /** A direction that cannot go any further */
  previousDisabled?: boolean
  nextDisabled?: boolean
  className?: string
}

export function PeriodNav({
  title,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  className,
}: PeriodNavProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={previousLabel}
        aria-disabled={previousDisabled || undefined}
        className={cn(previousDisabled && STOPPED)}
        onClick={previousDisabled ? undefined : onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span aria-live="polite">
        <Text variant="label" as="span">
          {title}
        </Text>
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={nextLabel}
        aria-disabled={nextDisabled || undefined}
        className={cn(nextDisabled && STOPPED)}
        onClick={nextDisabled ? undefined : onNext}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  )
}
