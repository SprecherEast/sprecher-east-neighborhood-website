'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import React, { useRef } from 'react'

import { cn } from '@/platform/lib/cn'

import { ALERT_ICONS, ALERT_TONE_CLASSES, type AlertTone } from './Alert'
import { Button } from './Button'

/** How a toast went away: it faded on its own, the reader closed it, or the reader accepted it */
export type ToastCloseReason = 'fade' | 'close' | 'accept'

/** How long a fading toast stays, unless it is told otherwise */
export const TOAST_FADE_MS = 5000

export type ToastProps = {
  message: React.ReactNode
  /** A short heading above the message */
  title?: React.ReactNode
  /** The kind of notice: the Alert's colours and its own icon. None keeps the neutral look */
  tone?: AlertTone
  /** A decorative Lucide icon in place of the tone's own */
  icon?: React.ReactNode
  /**
   * How it ends: `fade` closes by itself after `durationMs` (the reader can close it sooner),
   * `close` stays until the reader closes it, `accept` stays until the reader presses the accept
   * button, which is the only way out (not Escape, not a swipe): for a notice they must have read.
   */
  ending?: 'fade' | 'close' | 'accept'
  /** How long a fading toast stays, in milliseconds */
  durationMs?: number
  /** What the accept button says (the `accept` ending) */
  acceptLabel?: string
  /** Called when the reader accepts, before `onDismiss('accept')` */
  onAccept?: () => void
  /** One `Button`: what to do about the message */
  action?: React.ReactNode
  /** Called whenever it asks to go, with how it went: the caller then stops showing it */
  onDismiss: (reason: ToastCloseReason) => void
  /** What the close button says to screen readers */
  dismissLabel?: string
  /** False while it slides out, before the caller removes it */
  visible?: boolean
  /**
   * Where it sits: `screen` at the bottom of the screen; `above` directly above the nearest
   * positioned (`relative`) container, touching its top edge; `panel` inside that container, a
   * little in from its top edge and smaller, so it reads as a note on the panel.
   */
  placement?: 'screen' | 'above' | 'panel'
}

const PLACEMENT_CLASSES = {
  above: 'absolute inset-x-0 bottom-full z-10 mb-2',
  panel: 'absolute inset-x-3 top-3 z-10',
  screen: 'fixed z-50 inset-x-4 bottom-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2',
} as const

/*
 * A short notice (#434, #1377), such as "New version available". It is built on Radix Toast,
 * which times the fade (and waits while the reader points at it or has focus in it), announces it
 * to screen readers (politely, an error assertively) and handles Escape and swiping. The caller
 * decides when it shows and goes; `visible` drives the slide in and out, which the theme's
 * `toast-motion` skips for a reader who asked for less movement.
 */
export function Toast({
  message,
  title,
  tone,
  icon,
  ending = 'fade',
  durationMs = TOAST_FADE_MS,
  acceptLabel = 'Got it',
  onAccept,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  visible = true,
  placement = 'screen',
}: ToastProps) {
  // Why it is closing: set by what the reader pressed, else it is the timer
  const reason = useRef<ToastCloseReason>('fade')
  const Icon = tone ? ALERT_ICONS[tone] : null
  const mustAccept = ending === 'accept'
  const panel = placement !== 'screen'
  // Inside a panel it is smaller, so it sits as a note on it rather than a banner across it
  const compact = placement === 'panel'

  return (
    <ToastPrimitive.Provider
      duration={ending === 'fade' ? durationMs : Infinity}
      swipeDirection={panel ? 'up' : 'down'}
      label="Notifications"
    >
      <ToastPrimitive.Root
        open={visible}
        type={tone === 'error' ? 'foreground' : 'background'}
        onOpenChange={(open) => {
          if (open) return
          const why = reason.current
          reason.current = 'fade'
          onDismiss(why)
        }}
        onEscapeKeyDown={(event) => {
          if (mustAccept) event.preventDefault()
          else reason.current = 'close'
        }}
        onSwipeEnd={(event) => {
          if (mustAccept) event.preventDefault()
          else reason.current = 'close'
        }}
        className="toast-motion list-none overflow-hidden rounded-xl bg-background shadow-lg"
      >
        <div
          className={cn(
            'flex rounded-xl border',
            compact ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-3',
            // The neutral look is the one the update notice has always had; a tone is the Alert's
            tone
              ? cn(ALERT_TONE_CLASSES[tone], 'items-start')
              : 'items-center border-border bg-background text-foreground sm:px-5',
          )}
        >
          {(icon || Icon) && (
            <span
              aria-hidden="true"
              className={cn(
                // Larger on a phone, where the small one cannot be told apart
                compact
                  ? 'shrink-0 [&_svg]:size-5 sm:[&_svg]:size-4'
                  : 'shrink-0 [&_svg]:size-6 sm:[&_svg]:size-4',
                tone ? 'mt-0.5' : 'hidden text-primary sm:block',
              )}
            >
              {icon ?? (Icon && <Icon />)}
            </span>
          )}
          <div className={cn('min-w-0 flex-1', compact ? 'text-xs sm:text-sm' : 'text-sm')}>
            {title && (
              <ToastPrimitive.Title className="font-semibold">{title}</ToastPrimitive.Title>
            )}
            <ToastPrimitive.Description asChild>
              <p className={cn('font-medium', !tone && 'text-foreground')}>{message}</p>
            </ToastPrimitive.Description>
          </div>
          {action && <div className="shrink-0 self-center">{action}</div>}
          {mustAccept ? (
            <ToastPrimitive.Action altText={acceptLabel} asChild>
              <Button
                size="sm"
                className="shrink-0 self-center"
                onClick={() => {
                  reason.current = 'accept'
                  onAccept?.()
                }}
              >
                {acceptLabel}
              </Button>
            </ToastPrimitive.Action>
          ) : (
            <ToastPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'shrink-0 self-center',
                  tone
                    ? 'text-current hover:text-current'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label={dismissLabel}
                onClick={() => {
                  reason.current = 'close'
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </ToastPrimitive.Close>
          )}
        </div>
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport
        // One shortcut for the whole screen, not one per toast
        hotkey={panel ? [] : ['F8']}
        className={cn('m-0 list-none p-0', PLACEMENT_CLASSES[placement])}
      />
    </ToastPrimitive.Provider>
  )
}
