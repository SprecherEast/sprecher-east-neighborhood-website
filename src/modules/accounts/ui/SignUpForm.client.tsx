'use client'

import React, { useEffect, useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'
import { Alert } from '@/platform/ui/Alert'
import { TurnstileWidget } from '@/platform/turnstile/TurnstileWidget.client'
import { useRobotCheck } from '@/platform/turnstile/useRobotCheck.client'
import { Button, Field, Form, type FormStatus, Link } from '@/platform/ui'
import { HEADER_SCROLL_MARGIN } from '@/platform/ui/scrollMargin'

import { signUp } from '../actions'
import { signUpSchema, type SignUpInput, type SignUpValues } from '../domain/credentials'
import { SIGN_IN_PATH } from '../domain/paths'
import type { SignUpFailure } from '../domain/types'
import { NewPasswordFields } from './NewPasswordFields.client'
import { SIGN_UP_SENT, toSignUpErrorMessage } from './signUpMessages'

/**
 * Creates a guest account (#187). `email` fills in the address the confirm page sent, or is
 * `null`; it leaves the address bar and the history as soon as the form loads. Past the robot
 * check and the limits, every sign-up gets the same answer, and the account can't sign in until
 * Payload's link is opened.
 */
export function SignUpForm({ email }: { email: string | null }) {
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const doneRef = useRef<HTMLDivElement>(null)
  // The same robot check as the contact form (decision 0007): only when a site key is configured
  const robotCheck = useRobotCheck()

  useEffect(() => {
    // The browser's own history API; Next.js keeps its router in step with it
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  useEffect(() => {
    if (status !== 'success') return
    doneRef.current?.focus()
    // Clear of the sticky header (`HEADER_SCROLL_MARGIN` below), or the message's first line hides (#551)
    doneRef.current?.scrollIntoView({ block: 'start' })
  }, [status])

  const fail = (failure: SignUpFailure | 'offline') => {
    setErrorMessage(toSignUpErrorMessage(failure))
    setStatus('error')
  }

  // `Form` ignores a second submit while this runs, so one single-use token is sent once
  const send = async (values: SignUpValues) => {
    const pending = robotCheck.pendingMessage()
    if (pending) {
      setErrorMessage(pending)
      setStatus('error')
      return
    }
    setStatus('submitting')
    let result: Awaited<ReturnType<typeof signUp>>
    try {
      result = await signUp(values, robotCheck.token)
    } catch {
      robotCheck.renewToken()
      return fail('offline')
    }
    if (!result.ok) {
      robotCheck.renewToken()
      return fail(result.failure)
    }
    setStatus('success')
  }

  if (status === 'success') {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        className={cn(HEADER_SCROLL_MARGIN, 'space-y-6 outline-none')}
      >
        <Alert tone="success">{SIGN_UP_SENT}</Alert>
        <Link href={SIGN_IN_PATH} variant="action">
          Go to log in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Form<SignUpInput, SignUpValues>
        aria-label="Create an account"
        schema={signUpSchema}
        // Only the email has a real default; the other fields keep what the browser autofills
        defaultValues={email ? { email } : {}}
        onSubmit={send}
        status={status}
        errorMessage={errorMessage}
      >
        {({ register, formState: { errors } }) => (
          <>
            <Field label="Name" required error={errors.name?.message}>
              <Field.Input type="text" autoComplete="name" {...register('name')} />
            </Field>
            <Field label="Email" required error={errors.email?.message}>
              <Field.Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email')}
              />
            </Field>
            <NewPasswordFields label="Password" register={register} errors={errors} />
            {robotCheck.enabled && <TurnstileWidget {...robotCheck.widgetProps} />}
            <div>
              <Button type="submit" loading={status === 'submitting'} fullWidth>
                {status === 'submitting' ? 'Creating' : 'Create Account'}
              </Button>
            </div>
          </>
        )}
      </Form>
      <p className="text-muted-foreground">
        Already have an account?{' '}
        <Link href={SIGN_IN_PATH} variant="inline">
          Log in
        </Link>
      </p>
    </div>
  )
}
