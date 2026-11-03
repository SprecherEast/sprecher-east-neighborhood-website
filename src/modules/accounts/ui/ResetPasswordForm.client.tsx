'use client'

import React, { useEffect, useRef, useState } from 'react'

import { Alert } from '@/platform/ui/Alert'
import { Button, Form, type FormStatus } from '@/platform/ui'

import { resetPassword } from '../actions'
import { newPasswordSchema, type NewPasswordValues } from '../domain/credentials'
import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH } from '../domain/paths'
import type { ResetPasswordFailure } from '../domain/types'
import { NewPasswordFields } from './NewPasswordFields.client'
import { toResetPasswordErrorMessage } from './resetErrorMessages'

/**
 * Sets a new password from a reset link (#269). `token` is the link's, or `null` when it has none
 * or one that can't be a token. As soon as the form loads, the token leaves the address bar and
 * the history (#283); the form keeps the one it was first given, even if the page renders again
 * from the cleaned address.
 */
export function ResetPasswordForm({ token: linkToken }: { token: string | null }) {
  const [token] = useState(linkToken)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [failure, setFailure] = useState<ResetPasswordFailure | 'offline' | null>(
    token ? null : 'invalid-link',
  )
  const doneRef = useRef<HTMLDivElement>(null)

  const linkDone = status === 'success' || failure === 'invalid-link'
  useEffect(() => {
    // The browser's own history API; Next.js keeps its router in step with it
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  useEffect(() => {
    if (status === 'success') doneRef.current?.focus()
  }, [status])

  const fail = (next: ResetPasswordFailure | 'offline') => {
    setFailure(next)
    setStatus('error')
  }

  const submit = async ({ newPassword, confirmPassword }: NewPasswordValues) => {
    if (!token) return
    setStatus('submitting')
    let result: Awaited<ReturnType<typeof resetPassword>>
    try {
      result = await resetPassword({ token, newPassword, confirmPassword })
    } catch {
      return fail('offline')
    }
    if (result.ok) setStatus('success')
    else fail(result.failure)
  }

  if (status === 'success') {
    return (
      <div ref={doneRef} tabIndex={-1} className="space-y-6 outline-none">
        <Alert tone="success">Your new password is set. Log in with it now.</Alert>
        <Button href={SIGN_IN_PATH} fullWidth>
          Log In
        </Button>
      </div>
    )
  }

  if (linkDone) {
    return (
      <div className="space-y-6">
        <Alert tone="error">{toResetPasswordErrorMessage('invalid-link')}</Alert>
        <Button href={FORGOT_PASSWORD_PATH} fullWidth>
          Get a New Link
        </Button>
      </div>
    )
  }

  return (
    <Form
      aria-label="Choose a new password"
      schema={newPasswordSchema}
      defaultValues={{}}
      onSubmit={submit}
      status={status}
      errorMessage={failure ? toResetPasswordErrorMessage(failure) : undefined}
    >
      {({ register, formState: { errors } }) => (
        <>
          <NewPasswordFields register={register} errors={errors} />
          <div>
            <Button type="submit" loading={status === 'submitting'} fullWidth>
              {status === 'submitting' ? 'Saving' : 'Set New Password'}
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}
