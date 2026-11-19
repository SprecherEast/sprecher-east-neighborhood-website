'use client'

import React from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

import { Field } from '@/platform/ui'

import { MIN_PASSWORD_LENGTH } from '../domain/credentials'

type Props = {
  /** The form's `register`: this registers `newPassword` and `confirmPassword` itself */
  register: (name: 'newPassword' | 'confirmPassword') => UseFormRegisterReturn
  /** The form's `formState.errors`: it reads the message of each of the two fields */
  errors: Partial<Record<'newPassword' | 'confirmPassword', { message?: string }>>
  /** "Password" when the account is new; "New password" (the default) when it replaces one */
  label?: string
}

/**
 * The new password and its confirmation, with the length hint, as every account form asks for
 * them: sign-up, reset, change, and choosing one on the verify page (#289).
 */
export function NewPasswordFields({ register, errors, label = 'New password' }: Props) {
  return (
    <>
      <Field
        label={label}
        required
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.newPassword?.message}
      >
        <Field.Input type="password" autoComplete="new-password" {...register('newPassword')} />
      </Field>
      <Field
        label={`Confirm ${label.toLowerCase()}`}
        required
        error={errors.confirmPassword?.message}
      >
        <Field.Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
      </Field>
    </>
  )
}
