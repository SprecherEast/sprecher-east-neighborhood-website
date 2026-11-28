'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { Controller } from 'react-hook-form'

import { formatDuration } from '@/platform/lib'
import { Button, Field, Form, type FormStatus, Link } from '@/platform/ui'

import { signIn } from '../actions'
import { signInSchema, type SignInInput } from '../domain/credentials'
import { ACCOUNT_PATH, FORGOT_PASSWORD_PATH, SIGN_UP_PATH } from '../domain/paths'
import { REMEMBER_ME_LIFETIME_MS } from '../domain/sessionLifetimes'
import type { SignInFailure } from '../domain/types'
import { PasskeyButtonRoom } from './PasskeyButtonRoom'
import { toSignInErrorMessage } from './signInErrorMessage'
import { SignInMethods } from './SignInMethods'

// Loaded in the browser only when the form renders it, which it does only while the passkey switch
// is on: the button and the WebAuthn browser package are code a neighbor doesn't download
// otherwise. No server render: the button shows nothing until the browser says it can use a
// passkey anyway.
const PasskeySignIn = dynamic(() => import('./PasskeySignIn.client').then((m) => m.PasskeySignIn), {
  ssr: false,
  // Holds the button's room while its code loads, so the form below doesn't jump (#1365)
  loading: () => <PasskeyButtonRoom />,
})

/**
 * The sign-in form on /login, with the way to reset a forgotten password. On success it opens
 * `returnTo` (the account by default). The quick ways in come first, above the form, under one divider line (#1365): with
 * `passkeys` (the page passes it while the switch is on, decision 0021) "Log in with a passkey",
 * then `social` (the page's "Continue with Google", drawn on the server), and the passkey in the
 * email field's autofill. The passkey button honors the "Keep me signed in" box below it, so the
 * form tells it the box's state.
 */
export function SignInForm({
  passkeys = false,
  social,
  returnTo = ACCOUNT_PATH,
}: {
  passkeys?: boolean
  social?: React.ReactNode
  /** Where success goes: a page of this site the page checked (`safeReturnPath`), else the account */
  returnTo?: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  // The box lives in the form's fields; the passkey button, above them, needs its state
  const [rememberMe, setRememberMe] = useState(false)

  // Never the server's text (#204): it could say whether the account exists
  const fail = (failure: SignInFailure | 'offline') => {
    setErrorMessage(toSignInErrorMessage(failure))
    setStatus('error')
  }

  const logIn = async (values: SignInInput) => {
    setStatus('submitting')
    let result: Awaited<ReturnType<typeof signIn>>
    try {
      result = await signIn(values)
    } catch {
      return fail('offline')
    }
    if (!result.ok) return fail(result.failure)

    router.push(returnTo)
    router.refresh()
    setStatus('idle')
  }

  return (
    <div className="flex flex-col gap-6">
      <SignInMethods>
        {passkeys && <PasskeySignIn rememberMe={rememberMe} returnTo={returnTo} />}
        {social}
      </SignInMethods>
      <Form
        aria-label="Log in"
        schema={signInSchema}
        defaultValues={{ rememberMe: false }} // sets only the box, so an email typed or autofilled before the page loaded stays
        onSubmit={logIn}
        status={status}
        errorMessage={errorMessage}
      >
        {({ control, register, formState: { errors } }) => (
          <>
            <Field label="Email" required error={errors.email?.message}>
              <Field.Input
                type="email"
                // `webauthn` last offers a passkey in the browser's autofill list (WebAuthn conditional UI)
                autoComplete={passkeys ? 'username webauthn' : 'email'}
                placeholder="you@example.com"
                {...register('email')}
              />
            </Field>
            <Field label="Password" required error={errors.password?.message}>
              <Field.Input
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
            </Field>
            <div className="-mt-4">
              <Link href={FORGOT_PASSWORD_PATH} variant="action">
                Forgot your password?
              </Link>
            </div>
            {/* Unticked: a shared computer stays safe unless the person chooses otherwise (#587) */}
            <Controller
              control={control}
              name="rememberMe"
              render={({ field }) => (
                <Field label={`Keep me signed in for ${formatDuration(REMEMBER_ME_LIFETIME_MS)}`}>
                  <Field.Checkbox
                    name={field.name}
                    checked={field.value === true}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      setRememberMe(checked === true)
                    }}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </Field>
              )}
            />
            <div>
              <Button type="submit" loading={status === 'submitting'} fullWidth>
                {status === 'submitting' ? 'Logging in' : 'Log In'}
              </Button>
            </div>
          </>
        )}
      </Form>
      {/* The way in for visitors without an account (#296), as sign-up links back here */}
      <p className="text-muted-foreground">
        Don’t have an account?{' '}
        <Link href={SIGN_UP_PATH} variant="inline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
