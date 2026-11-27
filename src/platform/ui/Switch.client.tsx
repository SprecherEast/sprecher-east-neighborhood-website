'use client'

import { cn } from '@/platform/lib/cn'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentProps, ReactNode } from 'react'

export type SwitchControlProps = Omit<
  ComponentProps<typeof SwitchPrimitive.Root>,
  'asChild' | 'children'
>

/**
 * The track and thumb alone, for a `Field` (`Field.Switch`) that supplies the label. A native
 * button with the switch role (Radix), so Space and Enter work and a screen reader hears "on" or
 * "off". The track is 24 px tall; the after: area makes the target 44 px (WCAG 2.5.8). The thumb
 * slides the other way in a right-to-left page, and neither moves under reduced motion.
 */
export function SwitchControl({ className, ...rest }: SwitchControlProps) {
  return (
    <SwitchPrimitive.Root
      {...rest}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-input bg-muted p-px transition-colors duration-200 after:absolute after:inset-x-0 after:-inset-y-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive-strong data-[state=checked]:border-primary-fill data-[state=checked]:bg-primary-fill motion-reduce:transition-none',
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-muted-foreground shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground motion-reduce:transition-none rtl:data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

export type SwitchProps = SwitchControlProps & {
  /** What the switch turns on or off, in words; it is the switch's name for screen readers */
  label: ReactNode
  /** Keeps the label for screen readers only, where the context names the switch visually */
  hideLabel?: boolean
}

/**
 * An on or off switch with its label beside it; pressing the label works too. For a setting that
 * takes effect at once (a light or dark choice). A choice saved with a form goes in a `Field`
 * (`Field.Switch`), which adds a hint and an error. Controlled (`checked`, `onCheckedChange`) or
 * left to itself (`defaultChecked`); `name` and `value` take part in a form.
 */
export function Switch({ label, hideLabel = false, className, ...control }: SwitchProps) {
  return (
    <label
      className={cn(
        'inline-flex min-w-0 items-center gap-3 text-sm font-medium text-foreground has-[button:disabled]:cursor-not-allowed has-[button:disabled]:text-muted-foreground',
        className,
      )}
    >
      <SwitchControl {...control} />
      <span className={cn(hideLabel && 'sr-only')}>{label}</span>
    </label>
  )
}
