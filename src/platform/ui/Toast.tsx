import { X } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Button } from './Button'

export type ToastProps = {
  message: React.ReactNode
  /** A decorative Lucide icon before the message, shown from `sm` */
  icon?: React.ReactNode
  /** One `Button`: what to do about the message */
  action?: React.ReactNode
  onDismiss: () => void
  /** What the close button says to screen readers */
  dismissLabel?: string
  /** False while it slides out, before the caller removes it */
  visible?: boolean
}

/*
 * A short notice at the bottom of the screen (#434), such as "New version available". It is a
 * polite live region, so screen readers announce it without interrupting. The caller decides when
 * it shows and goes; `visible` drives the slide in and out.
 */
export function Toast({
  message,
  icon,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  visible = true,
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-4 bottom-6 z-50 transition-all duration-300 ease-out sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-lg sm:px-5">
        {icon && (
          <span aria-hidden="true" className="hidden shrink-0 text-primary sm:block [&_svg]:size-4">
            {icon}
          </span>
        )}
        <p className="text-sm font-medium text-foreground">{message}</p>
        {action && <div className="ml-auto shrink-0">{action}</div>}
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="icon"
          className={cn(
            'shrink-0 text-muted-foreground hover:text-foreground',
            !action && 'ml-auto',
          )}
          aria-label={dismissLabel}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
