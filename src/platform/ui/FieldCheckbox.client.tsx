'use client'

import { cn } from '@/platform/lib/cn'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'

import { useFieldControl } from './fieldContext'
import { TOUCH_TARGET } from './touchTarget'

export type FieldCheckboxProps = Omit<
  ComponentProps<typeof CheckboxPrimitive.Root>,
  'id' | 'asChild' | 'checked' | 'defaultChecked' | 'onCheckedChange' | 'children'
> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

/**
 * A yes-or-no box; place it inside a `Field`, which then lays out inline with the label after
 * the box. With react-hook-form, render it through a `Controller` (`checked`, `onCheckedChange`).
 */
export function FieldCheckbox({ className, onCheckedChange, ...rest }: FieldCheckboxProps) {
  const field = useFieldControl('Field.Checkbox')
  return (
    <CheckboxPrimitive.Root
      {...rest}
      {...field}
      // Radix also reports 'indeterminate'; this box is only ever yes or no
      onCheckedChange={(checked) => onCheckedChange?.(checked === true)}
      className={cn(
        // The box is 20 px; TOUCH_TARGET makes the tap area 44 px (WCAG 2.5.8), and the label next
        // to it is clickable too
        TOUCH_TARGET,
        'size-5 shrink-0 rounded-sm border border-input bg-background text-primary-foreground transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive-strong data-[state=checked]:border-primary-fill data-[state=checked]:bg-primary-fill',
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
