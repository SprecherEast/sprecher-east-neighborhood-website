'use client'

import { cn } from '@/platform/lib/cn'
import { type VariantProps, cva } from 'class-variance-authority'
import { Children, type ReactElement, type ReactNode, useId } from 'react'

import { FieldCheckbox } from './FieldCheckbox.client'
import { FieldInput } from './FieldInput.client'
import { FieldMoney } from './FieldMoney.client'
import { FieldSelect } from './FieldSelect.client'
import { FieldTextArea } from './FieldTextArea.client'
import { FieldContext, type FieldControlProps } from './fieldContext'

/**
 * One form field (docs/ui/component-set.md): the label, the required mark, a hint, the error and
 * exactly one control, a part of `Field`: `Field.Input`, `Field.TextArea`, `Field.Select` or
 * `Field.Checkbox`. The field gives the control its id, `aria-describedby` and `aria-invalid`.
 *
 * Use it in client components: its parts are properties of `Field`, which a server component
 * can't reach through the client boundary.
 */
export const fieldVariants = cva('flex min-w-0', {
  variants: {
    layout: {
      stacked: 'flex-col gap-2',
      // A checkbox, then its label, hint and error in a column beside it
      inline: 'flex-row items-start gap-3',
      // The label above; under it the control and an action button side by side (a box with its
      // own Estimate or Search button); hint and error go under both
      bar: 'flex-col gap-2',
    },
    // `half` shares a row in a `Form` from 640 px; below that, and outside a Form, every field
    // is full width (the Form's grid makes each cell full width unless told otherwise)
    width: {
      full: '',
      half: 'sm:col-span-1',
    },
  },
  defaultVariants: { width: 'full' },
})

export type FieldProps = Omit<VariantProps<typeof fieldVariants>, 'layout'> & {
  label: ReactNode
  /** Keeps the label for screen readers only, where the context labels the field visually */
  hideLabel?: boolean
  /** Shows a mark after the label, and "required" to screen readers */
  required?: boolean
  hint?: ReactNode
  /** Shown under the control, announced, and marks the control invalid */
  error?: string
  /** Defaults to `inline` for a checkbox and `stacked` for anything else; `bar` puts the label above and the control with its `action` on one line under it */
  layout?: VariantProps<typeof fieldVariants>['layout']
  /** The control's id; generated when left out */
  id?: string
  className?: string
  /** A button shown beside the control in the `bar` layout, such as a compact Estimate button */
  action?: ReactNode
  /** Exactly one control */
  children: ReactElement
}

export function Field({
  label,
  hideLabel = false,
  required = false,
  hint,
  error,
  layout,
  width,
  id,
  className,
  action,
  children,
}: FieldProps) {
  const control = Children.only(children)
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ')
  const wiring: FieldControlProps = {
    id: controlId,
    ...(describedBy && { 'aria-describedby': describedBy }),
    ...(error && { 'aria-invalid': true }),
  }
  const resolvedLayout = layout ?? (control.type === FieldCheckbox ? 'inline' : 'stacked')

  const labelElement = (
    <label
      htmlFor={controlId}
      className={cn(
        'text-sm font-medium text-foreground',
        resolvedLayout === 'bar' && 'text-base',
        hideLabel && 'sr-only',
      )}
    >
      {label}
      {required && (
        <>
          {' '}
          <span aria-hidden="true" className="text-destructive-strong">
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      )}
    </label>
  )
  const hintElement = hint && (
    <p id={hintId} className="text-sm text-muted-foreground">
      {hint}
    </p>
  )
  // role="alert": announced as soon as it appears, so a screen reader hears what went wrong
  const errorElement = error && (
    <p id={errorId} role="alert" className="text-sm font-medium text-destructive-strong">
      {error}
    </p>
  )

  return (
    <FieldContext value={wiring}>
      <div className={cn(fieldVariants({ layout: resolvedLayout, width }), className)}>
        {resolvedLayout === 'inline' ? (
          <>
            {control}
            <div className="flex min-w-0 flex-col gap-1">
              {labelElement}
              {hintElement}
              {errorElement}
            </div>
          </>
        ) : resolvedLayout === 'bar' ? (
          <>
            {labelElement}
            {hintElement}
            <div data-field-bar className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">{control}</div>
              {action}
            </div>
            {errorElement}
          </>
        ) : (
          <>
            {labelElement}
            {hintElement}
            {control}
            {errorElement}
          </>
        )}
      </div>
    </FieldContext>
  )
}

Field.Input = FieldInput
Field.Money = FieldMoney
Field.TextArea = FieldTextArea
Field.Select = FieldSelect
Field.Checkbox = FieldCheckbox
