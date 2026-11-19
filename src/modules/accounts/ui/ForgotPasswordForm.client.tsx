'use client'

import React, { useState } from 'react'

import { formatDuration, message } from '@/platform/lib'
import { TurnstileWidget } from '@/platform/turnstile/TurnstileWidget.client'
import { useRobotCheck } from '@/platform/turnstile/useRobotCheck.client'
import { Button, Field, Form, type FormStatus, Link } from '@/platform/ui'

import { forgotPassword } from '../actions'
import { forgotPasswordSchema, type ForgotPasswordValues } from '../domain/credentials'
import { RESET_LINK_LIFETIME_MS } from '../domain/linkLifetimes'
import { SIGN_IN_PATH } from '../domain/paths'
import type { ForgotPasswordFailure } from '../domain/types'
import { toForgotPasswordErrorMessage } from './resetErrorMessages'

/**
 * Asks for a reset link (#269). The answer never says whether an account uses the email: the
 * same text shows for every request (docs/guidelines/security.md).
 */
export const FORGOT_PASSWORD_SENT = message('accounts.forgotPassword.sent', {
  linkLifetime: formatDuration(RESET_LINK_LIFETIME_MS),
})

/** The form on /forgot-password. */
export function ForgotPasswordForm() {
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  // The same robot check as the contact form (#282): only when a site key is configured
  const robotCheck = useRobotCheck()

  const fail = (failure: ForgotPasswordFailure | 'offline') => {
    setErrorMessage(toForgotPasswordErrorMessage(failure))
    setStatus('error')
  }

  // `Form` ignores a second submit while this runs, so one single-use token is sent once
  const send = async (values: ForgotPasswordValues) => {
    const pending = robotCheck.pendingMessage()
    if (pending) {
      setErrorMessage(pending)
      setStatus('error')
      return
    }
    setStatus('submitting')
    let result: Awaited<ReturnType<typeof forgotPassword>>
    try {
      result = await forgotPassword(values, robotCheck.token)
    } catch {
      robotCheck.renewToken()
      return fail('offline')
    }
    // The form stays after a success, so the next request needs a fresh token too
    robotCheck.renewToken()
    if (!result.ok) return fail(result.failure)
    setStatus('success')
  }

  return (
    <div className="space-y-6">
      <Form
        aria-label="Reset password"
        schema={forgotPasswordSchema}
        defaultValues={{}} // keeps an email typed or autofilled before the page loaded
        onSubmit={send}
        status={status}
        successMessage={FORGOT_PASSWORD_SENT}
        errorMessage={errorMessage}
      >
        {({ register, formState: { errors } }) => (
          <>
            <Field label="Email" required error={errors.email?.message}>
              <Field.Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email')}
              />
            </Field>
            {robotCheck.enabled && <TurnstileWidget {...robotCheck.widgetProps} />}
            <div>
              <Button type="submit" loading={status === 'submitting'} fullWidth>
                {status === 'submitting' ? 'Sending' : 'Send Reset Link'}
              </Button>
            </div>
          </>
        )}
      </Form>
      <Link href={SIGN_IN_PATH} variant="action">
        Back to log in
      </Link>
    </div>
  )
}
