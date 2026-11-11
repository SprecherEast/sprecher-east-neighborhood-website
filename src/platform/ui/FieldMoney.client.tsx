'use client'

import type { ChangeEvent, ComponentProps } from 'react'
import { useLayoutEffect, useRef } from 'react'

import { caretAfterDigits, formatMoneyTyping } from '@/platform/lib/money'

import { FieldInput } from './FieldInput.client'

export type FieldMoneyProps = Omit<
  ComponentProps<typeof FieldInput>,
  'type' | 'value' | 'onChange' | 'inputMode'
> & {
  /** The box's text, as `formatMoneyTyping` writes it */
  value: string
  /** The new text, already grouped, whenever the reader changes the box */
  onValueChange: (value: string) => void
}

/**
 * A whole-dollar box (#1035): the reader types digits and the box shows them grouped by commas
 * after a dollar sign, as they go; cents are cut. The caret stays after the digit the reader just
 * typed or deleted, even when commas appear before it. Place it inside a `Field`.
 */
export function FieldMoney({ value, onValueChange, ref, ...rest }: FieldMoneyProps) {
  const own = useRef<HTMLInputElement | null>(null)
  // Digits to the left of the caret after the last change, restored once the new text is drawn
  const digits = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = own.current
    if (digits.current === null || !input || document.activeElement !== input) return
    const at = caretAfterDigits(input.value, digits.current)
    input.setSelectionRange(at, at)
    digits.current = null
  }, [value])

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const { value: typed, selectionStart } = event.target
    const before = typed.slice(0, selectionStart ?? typed.length).replace(/\D/g, '').length
    const written = formatMoneyTyping(typed)
    if (written === value) {
      // Nothing changes, so React draws nothing and the browser would send the caret to the end
      // (a refused letter, a comma removed by Backspace): put it back once React has reset the box
      const input = event.target
      queueMicrotask(() => {
        const at = caretAfterDigits(input.value, before)
        input.setSelectionRange(at, at)
      })
      return
    }
    digits.current = before
    onValueChange(written)
  }

  return (
    <FieldInput
      {...rest}
      ref={(node: HTMLInputElement | null) => {
        own.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={change}
    />
  )
}
