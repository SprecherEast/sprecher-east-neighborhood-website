import { cva } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * A message box in one of four tones (#226). Each tone is a 10% tint of its colour with the
 * matching -strong text, which the theme contract checks at 4.5:1 on the page, a surface and a
 * card (`TINTED_PAIRS` in `src/platform/theme/tokens.ts`). The icon says the tone too, so it
 * isn't told by colour alone.
 */
const alertVariants = cva('flex gap-3 rounded-md border p-3 text-sm', {
  variants: {
    tone: {
      info: 'border-info/30 bg-info/10 text-info-strong',
      success: 'border-primary/30 bg-primary/10 text-primary-strong',
      warning: 'border-warning/30 bg-warning/10 text-warning-strong',
      error: 'border-destructive/30 bg-destructive/10 text-destructive-strong',
    },
  },
})

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
}

export interface AlertProps {
  tone: AlertTone
  /** A short heading above the message */
  title?: React.ReactNode
  /**
   * Whether screen readers announce it when it appears: on for messages that answer what the
   * visitor did (errors interrupt, the rest wait their turn). Off for a message that is part of
   * the page's content, such as a banner in a post, which is read in its place.
   */
  live?: boolean
  className?: string
  children: React.ReactNode
}

export function Alert({ tone, title, live = true, className, children }: AlertProps) {
  const Icon = ICONS[tone]
  const announce = live
    ? tone === 'error'
      ? ({ role: 'alert', 'aria-live': 'assertive' } as const)
      : ({ role: 'status', 'aria-live': 'polite' } as const)
    : {}

  return (
    <div
      {...announce}
      aria-atomic={live || undefined}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  )
}
