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
  /** Classes for the panel: the mobile menu sets `lg:hidden` */
  className?: string
  children: React.ReactNode
}

/*
 * A modal panel (#437, docs/ui/component-set.md). `sheet` fills the screen, with a top bar the
 * height of the site header: `start` on the left and the close button where the menu button was. Radix Dialog gives the behaviour: focus moves in and is trapped,
 * Escape and an outside click close it, the page behind is hidden from assistive tech and doesn't
 * scroll, and focus goes back to the trigger.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  trigger,
  closeLabel = 'Close',
  start,
  className,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        {/* Radix locks the page's scroll from the overlay, so the sheet always has one */}
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-background" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background focus:outline-none',
            className,
          )}
        >
          <div className="border-b border-border">
            <div className="container flex items-center justify-between gap-4 py-4">
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
