'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Button } from './Button'

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the dialog for screen readers; `hideTitle` keeps it off screen */
  title: string
  hideTitle?: boolean
  /** The button that opens it; focus returns there when the dialog closes */
  trigger?: React.ReactNode
  /** What the close button says to screen readers */
  closeLabel?: string
  /** Shown left of the close button in the sheet's top bar: the site logo for the menu */
  start?: React.ReactNode
  /** `sheet` fills the screen (the default); `center` is a panel over the page, for reading one thing (#946) */
  placement?: 'sheet' | 'center'
  /** Classes for the panel: the mobile menu sets `lg:hidden` */
  className?: string
  children: React.ReactNode
}

/*
 * A modal panel (#437, docs/ui/component-set.md). `sheet` fills the screen, with a top bar the
 * height of the site header: `start` on the left and the close button where the menu button was. Radix Dialog gives the behaviour: focus moves in and is trapped,
 * Escape and an outside click close it, the page behind is hidden from assistive tech and doesn't
 * scroll, and focus goes back to the trigger. `placement="center"` is a panel over a dimmed page
 * instead (#946).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  trigger,
  closeLabel = 'Close',
  start,
  placement = 'sheet',
  className,
  children,
}: DialogProps) {
  const centered = placement === 'center'
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        {/* Radix locks the page's scroll from the overlay, so the sheet always has one */}
        <RadixDialog.Overlay
          className={cn('fixed inset-0 z-50', centered ? 'bg-scrim/60' : 'bg-background')}
        />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 overflow-y-auto overscroll-contain focus:outline-none',
            centered
              ? 'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-lg'
              : 'inset-0 bg-background',
            className,
          )}
        >
          <div className="border-b border-border">
            <div
              className={cn(
                'flex items-center justify-between gap-4 py-4',
                centered ? 'px-6' : 'container',
              )}
            >
              {start}
              <RadixDialog.Title
                className={cn('text-lg font-semibold text-foreground', hideTitle && 'sr-only')}
              >
                {title}
              </RadixDialog.Title>
              <RadixDialog.Close asChild>
                <Button variant="ghost" size="icon" className="ml-auto" aria-label={closeLabel}>
                  <X aria-hidden="true" />
                </Button>
              </RadixDialog.Close>
            </div>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
