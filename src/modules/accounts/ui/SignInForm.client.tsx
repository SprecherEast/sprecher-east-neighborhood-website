'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { Controller, useWatch, type Control } from 'react-hook-form'

import { formatDuration } from '@/platform/lib'
import { Button, Field, Form, type FormStatus, Link } from '@/platform/ui'

import { signIn } from '../actions'
import { signInSchema, type SignInInput } from '../domain/credentials'
import { ACCOUNT_PATH, FORGOT_PASSWORD_PATH, SIGN_UP_PATH } from '../domain/paths'
import { REMEMBER_ME_LIFETIME_MS } from '../domain/sessionLifetimes'
import type { SignInFailure } from '../domain/types'
import { toSignInErrorMessage } from './signInErrorMessage'

// Loaded in the browser only when the form renders it, which it does only while the passkey switch
// is on: the button and the WebAuthn browser package are code a neighbor doesn't download
// otherwise. No server render: the button shows nothing until the browser says it can use a
// passkey anyway.
const PasskeySignIn = dynamic(() => import('./PasskeySignIn.client').then((m) => m.PasskeySignIn), {
  ssr: false,
})

/** The passkey button, which logs in with the "Keep me signed in" box as the form has it. */
function PasskeyOption({ control }: { control: Control<SignInInput> }) {
  const rememberMe = useWatch({ control, name: 'rememberMe' })
  return <PasskeySignIn rememberMe={rememberMe === true} />
}

/**
 * The sign-in form on /login, with the way to reset a forgotten password. On success it opens
 * /account. With `passkeys` (the page passes it while the switch is on, decision 0021) it also
 * offers "Log in with a passkey" under the button, and the passkey in the email field's autofill.
 */
export function SignInForm({ passkeys = false }: { passkeys?: boolean }) {
  const router = useRouter()
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

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

    router.push(ACCOUNT_PATH)
    router.refresh()
    setStatus('idle')
  }

  return (
    <div className="space-y-6">
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
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </Field>
              )}
            />
            <div className="space-y-3">
              <Button type="submit" loading={status === 'submitting'} fullWidth>
                {status === 'submitting' ? 'Logging in' : 'Log In'}
              </Button>
              {passkeys && <PasskeyOption control={control} />}
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
