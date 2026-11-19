import { z } from 'zod'

import { parseEmailAddress } from '@/platform/lib'

// One set of rules for the forms in the browser and the server actions, which check again
// because anyone can call an action directly (https://nextjs.org/docs/app/guides/data-security).

export const MIN_PASSWORD_LENGTH = 8
/** Far above any real password; bounds the work an anonymous caller can ask of the hashing */
export const MAX_PASSWORD_LENGTH = 1024
/** The longest an email address can be (RFC 5321: 64 + 1 + 255), with room to spare */
export const MAX_EMAIL_LENGTH = 320
/** Long enough for any real name, short enough for the header */
export const MAX_NAME_LENGTH = 100
/** Far above Payload's reset and verify tokens (40 characters in 3.91) */
const MAX_TOKEN_LENGTH = 128

/** The email field of the sign-in and forgot-password forms. */
const email = z.string().trim().min(1, 'Enter your email address').max(MAX_EMAIL_LENGTH)

/**
 * Strict like every action schema: a field the form doesn't have is refused, not ignored.
 * `rememberMe` is the "Keep me signed in" box (#587); a caller that leaves it out gets the short
 * sign-in.
 */
export const signInSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Enter your password').max(MAX_PASSWORD_LENGTH),
  rememberMe: z.boolean().default(false),
})

export type SignInInput = z.input<typeof signInSchema>
export type SignInValues = z.output<typeof signInSchema>

/** A new password, typed twice: one rule for changing it and for resetting it. */
const newPasswordFields = {
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters`),
  confirmPassword: z.string().min(1, 'Type the new password again').max(MAX_PASSWORD_LENGTH),
}

const passwordsMatch = {
  check: (values: { newPassword: string; confirmPassword: string }) =>
    values.newPassword === values.confirmPassword,
  issue: { message: 'The passwords don’t match', path: ['confirmPassword'] },
}

/**
 * A new password for the signed-in account, with its current one (#233). Strict: the account is
 * always the signed-in one, so an extra field (such as an `id` or an `email`) is refused rather
 * than ignored. The current password is kept exactly as typed, like the one used to sign in.
 */
export const passwordChangeSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Enter your current password').max(MAX_PASSWORD_LENGTH),
    ...newPasswordFields,
  })
  .refine(passwordsMatch.check, passwordsMatch.issue)

export type PasswordChangeValues = z.output<typeof passwordChangeSchema>

/** Asking for a reset link (#269). */
export const forgotPasswordSchema = z.strictObject({ email })

export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>

/** The reset form's fields: the new password, typed twice. */
export const newPasswordSchema = z
  .strictObject(newPasswordFields)
  .refine(passwordsMatch.check, passwordsMatch.issue)

export type NewPasswordValues = z.output<typeof newPasswordSchema>

/**
 * A new password set from a reset link (#269), as the action gets it. The token comes from the
 * link, not from a field the person types; Payload checks it and its expiry.
 */
export const resetPasswordSchema = z
  .strictObject({
    token: z.string().min(1).max(MAX_TOKEN_LENGTH),
    ...newPasswordFields,
  })
  .refine(passwordsMatch.check, passwordsMatch.issue)

export type ResetPasswordValues = z.output<typeof resetPasswordSchema>

/**
 * A new resident account (#187). The email must be one plain address, stored lowercase like every
 * address the site keeps; the role is never a field, the server always sets it.
 */
export const signUpSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1, 'Enter your name')
      .max(MAX_NAME_LENGTH, `Use at most ${MAX_NAME_LENGTH} characters`),
    email: email
      .refine((value) => parseEmailAddress(value) !== null, 'Enter one email address')
      .transform((value) => value.toLowerCase()),
    ...newPasswordFields,
  })
  .refine(passwordsMatch.check, passwordsMatch.issue)

export type SignUpInput = z.input<typeof signUpSchema>
export type SignUpValues = z.output<typeof signUpSchema>

/**
 * The token from a verification link (#187); Payload checks it. A link resent after a second
 * sign-up also needs the password the person chooses on the verify page (#289): both fields or
 * neither.
 */
export const verifyAccountSchema = z
  .strictObject({
    token: z.string().min(1).max(MAX_TOKEN_LENGTH),
    newPassword: newPasswordFields.newPassword.optional(),
    confirmPassword: newPasswordFields.confirmPassword.optional(),
  })
  .refine(
    ({ newPassword, confirmPassword }) =>
      newPassword === undefined
        ? confirmPassword === undefined
        : passwordsMatch.check({ newPassword, confirmPassword: confirmPassword ?? '' }),
    passwordsMatch.issue,
  )

export type VerifyAccountValues = z.output<typeof verifyAccountSchema>
