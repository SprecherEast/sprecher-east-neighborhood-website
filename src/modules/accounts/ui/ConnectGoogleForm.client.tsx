'use client'

import { LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, Field, Form, FORM_MESSAGES, type FormStatus } from '@/platform/ui'

import { connectGoogle } from '../actions'
import { connectGoogleSchema } from '../domain/googleLink'
import { ACCOUNT_PATH } from '../domain/paths'
import { ConnectGoogleClosed } from './ConnectGoogleClosed'
import { GUARD_MESSAGES } from './guardMessages'

/**
 * The password step at sign-in (#1338, decision 0020): "This email already has an account. Enter
 * your password once to connect Google." It names no email and no account, and the server reads
 * both from what Google said. A wrong password uses up what Google said, so a refusal ends here
 * with the one fixed message and a way back to log in (`ConnectGoogleClosed`); only "too many" keeps the form. On success
 * it opens the account page, signed in.
 */
export function ConnectGoogleForm() {
  const router = useRouter()
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [ended, setEnded] = useState(false)

  if (ended) return <ConnectGoogleClosed />

  return (
    <Form
      aria-label="Connect Google"
      schema={connectGoogleSchema}
      defaultValues={{}} // keeps what was typed before the page loaded
      onSubmit={async (values) => {
        setStatus('submitting')
        let result: Awaited<ReturnType<typeof connectGoogle>>
        try {
          result = await connectGoogle(values)
        } catch {
          setErrorMessage(FORM_MESSAGES.offline)
          return setStatus('error')
        }
        if (result.ok) {
          router.push(ACCOUNT_PATH)
          router.refresh()
          return setStatus('idle')
        }
        if (result.failure === 'too-many') {
          setErrorMessage(GUARD_MESSAGES['too-many'])
          return setStatus('error')
        }
        setEnded(true)
      }}
      status={status}
      errorMessage={errorMessage}
    >
      {({ register, formState: { errors } }) => (
        <>
          <Field label="Password" required error={errors.password?.message}>
            <Field.Input
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
          </Field>
          <div>
            <Button
              type="submit"
              fullWidth="mobile"
              loading={status === 'submitting'}
              iconStart={<LogIn aria-hidden />}
            >
              Connect Google
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}
