import { cva } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * How far along something is: a native `<progress>`, so assistive technology reads it as a named
 * progress bar with no extra markup, and the fill's width comes from the element's own value, never
 * from an inline style. The track is `muted` and the fill `primary-fill`, tokens the theme contract
 * checks. The number it stands for is always written next to it by the caller ("3 of 8 done"), so
 * the bar is never the only signal.
 */
const progressVariants = cva(
  'block w-full appearance-none overflow-hidden rounded-full border-0 bg-muted [&::-moz-progress-bar]:bg-primary-fill [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary-fill [&::-webkit-progress-value]:transition-all',
  {
    variants: {
      size: { sm: 'h-1.5', md: 'h-2.5' },
    },
    defaultVariants: { size: 'md' },
  },
)

export type ProgressBarProps = {
  value: number
  max: number
  /** What it measures, for screen readers: "Launch: 3 of 8 done" */
  label: string
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, max, label, size, className }: ProgressBarProps) {
  // An element with a `max` of 0 is invalid: with nothing to count, show an empty bar
  const safeMax = max > 0 ? max : 1
  const safeValue = max > 0 ? Math.min(Math.max(value, 0), max) : 0

  return (
    <progress
      value={safeValue}
      max={safeMax}
      aria-label={label}
      className={cn(progressVariants({ size }), className)}
    />
  )
}
