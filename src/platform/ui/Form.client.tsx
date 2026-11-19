'use client'

import { Alert } from './Alert'
import { cn } from '@/platform/lib/cn'
import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { type DefaultValues, type FieldValues, type UseFormReturn, useForm } from 'react-hook-form'
import type { z } from 'zod'

import { FORM_MESSAGES } from './formMessages'
import { HEADER_SCROLL_MARGIN } from './scrollMargin'

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

export type FormApi<Input extends FieldValues, Output> = UseFormReturn<Input, unknown, Output>

export type FormProps<Input extends FieldValues, Output> = {
  /** Checked on submit, then on every change to a field that has failed */
  schema: z.ZodType<Output, Input>
  /**
   * Starting values. Leave text inputs out unless they have a real default: an input with no
   * default keeps what the browser already holds (typed or autofilled before the page loaded).
   */
  defaultValues?: DefaultValues<Input>
  /** Gets the parsed values. A second submit while this runs is ignored */
  onSubmit: (values: Output, form: FormApi<Input, Output>) => void | Promise<void>
  /** Set by the caller, so it decides what success and failure mean */
  status: FormStatus
  /** Shown while `status` is `success`. A fixed text, never what the server sent */
  successMessage?: ReactNode
  /** Shown while `status` is `error`. A fixed text, never what the server sent (#204) */
  errorMessage?: ReactNode
  /**
   * The fields, as grid cells: each is full width, and a `Field` with `width="half"` shares a row
   * from 640 px. Wrap anything else, such as the submit button, in a `div`.
   */
  children: (form: FormApi<Input, Output>) => ReactNode
  id?: string
  className?: string
  'aria-label'?: string
}

/**
 * A form (docs/ui/component-set.md): react-hook-form with a Zod schema. It shows the fixed
 * success or error message for `status`, hides it again as soon as a field changes, and lays the
 * fields out in a grid. The caller places the submit `Button` (`loading` while submitting).
 */
export function Form<Input extends FieldValues, Output>({
  schema,
  defaultValues,
  onSubmit,
  status,
  successMessage,
  errorMessage = FORM_MESSAGES.failed,
  children,
  className,
  ...rest
}: FormProps<Input, Output>) {
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(schema), defaultValues })
  // Blocks a double click from sending twice: the status prop only updates after a render
  const submitting = useRef(false)
  const [feedbackHidden, setFeedbackHidden] = useHiddenAfterEdit(form, submitting)
  const successRef = useRef<HTMLDivElement>(null)

  const showSuccess = status === 'success' && !feedbackHidden && successMessage
  const showError = status === 'error' && !feedbackHidden

  // A success often replaces what had focus (the button); move focus to the message instead, and
  // scroll it clear of the sticky header (`HEADER_SCROLL_MARGIN` below), or its first line hides (#551)
  useEffect(() => {
    if (status !== 'success') return
    successRef.current?.focus()
    successRef.current?.scrollIntoView({ block: 'start' })
  }, [status])

  const submit = form.handleSubmit(async (values) => {
    if (submitting.current) return
    submitting.current = true
    setFeedbackHidden(false)
    try {
      await onSubmit(values, form)
    } finally {
      submitting.current = false
    }
  })

  return (
    <form
      {...rest}
      // Before the script runs (a slow phone, a chunk that failed to load), the browser submits
      // the form itself. POST keeps the fields out of the URL, so out of history, logs and the
      // Referer (#232). With no `action`, it posts to the page, which Next.js renders again
      // without reading the body: a form-urlencoded POST is never run as a server action.
      method="post"
      noValidate // the schema validates, with messages tied to each field
      onSubmit={submit}
      className={cn('grid items-start gap-6 *:col-span-full sm:grid-cols-2', className)}
    >
      {showSuccess && (
        <div ref={successRef} tabIndex={-1} className={cn(HEADER_SCROLL_MARGIN, 'outline-none')}>
          <Alert tone="success">{successMessage}</Alert>
        </div>
      )}
      {showError && <Alert tone="error">{errorMessage}</Alert>}
      {children(form)}
    </form>
  )
}

/**
 * Hides the shown message once a field changes, so it can't be read as about the new input. The
 * next submit shows messages again.
 */
function useHiddenAfterEdit<Input extends FieldValues, Output>(
  form: FormApi<Input, Output>,
  submitting: RefObject<boolean>,
) {
  const [hidden, setHidden] = useState(false)

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        // Changes while onSubmit runs are its own (a reset after a success), not a person's
        callback: ({ name }) => {
          if (name && !submitting.current) setHidden(true)
        },
      }),
    [form, submitting],
  )
  return [hidden, setHidden] as const
}
