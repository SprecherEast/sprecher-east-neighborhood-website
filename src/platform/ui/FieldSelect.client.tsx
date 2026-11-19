'use client'

import { cn } from '@/platform/lib/cn'
import * as SelectPrimitive from '@radix-ui/react-select'
import type { VariantProps } from 'class-variance-authority'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { Ref } from 'react'

import { controlVariants } from './controlVariants'
import { useFieldControl } from './fieldContext'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'

export type SelectOption = { label: string; value: string }

export type FieldSelectProps = VariantProps<typeof controlVariants> & {
  options: readonly SelectOption[]
  /** Shown until something is chosen. Say what to choose, don't repeat the label */
  placeholder?: string
  /** `''` shows the placeholder */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onBlur?: () => void
  /** Submitted with a native form; react-hook-form doesn't need it */
  name?: string
  disabled?: boolean
  ref?: Ref<HTMLButtonElement>
  className?: string
}

const scrollButton = 'flex h-8 cursor-default items-center justify-center text-muted-foreground'

/**
 * Choose one option from a list; place it inside a `Field`. Radix draws the list, so keyboard,
 * typeahead and screen-reader support come with it. With react-hook-form, render it through a
 * `Controller` (`value`, `onValueChange`, `onBlur`, `ref`): it has no native input to register.
 */
export function FieldSelect({
  options,
  placeholder = 'Choose one',
  size,
  className,
  ref,
  onBlur,
  ...root
}: FieldSelectProps) {
  const field = useFieldControl('Field.Select')
  return (
    <SelectPrimitive.Root {...root}>
      <SelectPrimitive.Trigger
        {...field}
        ref={ref}
        onBlur={onBlur}
        className={cn(
          controlVariants({ size }),
          'flex items-center justify-between gap-2 text-left data-placeholder:text-muted-foreground',
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        {/* As wide as the trigger; as tall as fits on screen, at most 24rem */}
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] w-(--radix-select-trigger-width) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
        >
          <SelectPrimitive.ScrollUpButton className={scrollButton}>
            <ChevronUp aria-hidden="true" className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              // 44 px rows on phones (WCAG 2.5.8), denser from lg up where a pointer is likely
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  TOUCH_MIN_HEIGHT,
                  'relative flex cursor-default items-center rounded-md py-2 pr-9 pl-3 text-base outline-none select-none data-disabled:opacity-60 data-highlighted:bg-secondary lg:text-sm',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 flex">
                  <Check aria-hidden="true" className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className={scrollButton}>
            <ChevronDown aria-hidden="true" className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
