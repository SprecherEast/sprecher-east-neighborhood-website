import { describe, expect, it } from 'vitest'

import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  forgotPasswordSchema,
  newPasswordSchema,
  passwordChangeSchema,
  resetPasswordSchema,
  signInSchema,
} from './credentials'

describe('signInSchema', () => {
  it('accepts an email and a password, and trims the email', () => {
    expect(signInSchema.parse({ email: ' ada@example.com ', password: ' secret ' })).toEqual({
      email: 'ada@example.com',
      password: ' secret ',
      rememberMe: false,
    })
  })

  it('keeps the sign-in short unless "Keep me signed in" is ticked (#587)', () => {
    const base = { email: 'ada@example.com', password: 'secret' }
    expect(signInSchema.parse(base).rememberMe).toBe(false)
    expect(signInSchema.parse({ ...base, rememberMe: false }).rememberMe).toBe(false)
    expect(signInSchema.parse({ ...base, rememberMe: true }).rememberMe).toBe(true)
  })

  it('refuses a rememberMe that is not a yes or no', () => {
    const base = { email: 'ada@example.com', password: 'secret' }
    for (const rememberMe of ['true', 1, null, 'yes']) {
      expect(signInSchema.safeParse({ ...base, rememberMe }).success).toBe(false)
    }
  })

  it('refuses a missing or blank email and an empty password', () => {
    expect(signInSchema.safeParse({ email: '   ', password: 'secret' }).success).toBe(false)
    expect(signInSchema.safeParse({ email: 'ada@example.com', password: '' }).success).toBe(false)
    expect(signInSchema.safeParse({ password: 'secret' }).success).toBe(false)
    expect(signInSchema.safeParse(null).success).toBe(false)
  })

  it('refuses any other field', () => {
    const extra = { email: 'a@example.com', password: 'x', role: 'admin' }
    expect(signInSchema.safeParse(extra).success).toBe(false)
  })

  it('refuses an email or a password longer than any real one', () => {
    expect(MAX_EMAIL_LENGTH).toBe(320)
    const email = (length: number) => `${'a'.repeat(length - 12)}@example.com`
    expect(signInSchema.safeParse({ email: email(MAX_EMAIL_LENGTH), password: 'x' }).success).toBe(
      true,
    )
    expect(
      signInSchema.safeParse({ email: email(MAX_EMAIL_LENGTH + 1), password: 'x' }).success,
    ).toBe(false)
    const password = (length: number) => ({ email: 'a@example.com', password: 'p'.repeat(length) })
    expect(signInSchema.safeParse(password(MAX_PASSWORD_LENGTH)).success).toBe(true)
    expect(signInSchema.safeParse(password(MAX_PASSWORD_LENGTH + 1)).success).toBe(false)
  })
})

describe('passwordChangeSchema', () => {
  const long = 'a'.repeat(MIN_PASSWORD_LENGTH)
  const currentPassword = ' old secret '

  it('needs at least 8 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    expect(
      passwordChangeSchema.safeParse({
        currentPassword,
        newPassword: short,
        confirmPassword: short,
      }).success,
    ).toBe(false)
    expect(
      passwordChangeSchema.parse({ currentPassword, newPassword: long, confirmPassword: long }),
    ).toEqual({ currentPassword, newPassword: long, confirmPassword: long })
  })

  it('needs the current password, kept exactly as typed', () => {
    const values = { newPassword: long, confirmPassword: long }
    const missing = passwordChangeSchema.safeParse(values)
    expect(missing.success).toBe(false)
    expect(missing.error?.issues.map((issue) => issue.path[0])).toContain('currentPassword')
    const empty = passwordChangeSchema.safeParse({ ...values, currentPassword: '' })
    expect(empty.error?.issues[0]?.message).toBe('Enter your current password')
    // Any old password is accepted here, however short: Payload is the one that checks it
    expect(passwordChangeSchema.parse({ ...values, currentPassword: 'x' }).currentPassword).toBe(
      'x',
    )
  })

  it('refuses a current password longer than any real one', () => {
    const at = (length: number) =>
      passwordChangeSchema.safeParse({
        currentPassword: 'p'.repeat(length),
        newPassword: long,
        confirmPassword: long,
      }).success
    expect(at(MAX_PASSWORD_LENGTH)).toBe(true)
    expect(at(MAX_PASSWORD_LENGTH + 1)).toBe(false)
  })

  it('needs the two passwords to match, and says so on the confirmation', () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword,
      newPassword: long,
      confirmPassword: `${long}b`,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('refuses a new password longer than any real one', () => {
    const at = (length: number) => {
      const password = 'p'.repeat(length)
      return passwordChangeSchema.safeParse({
        currentPassword,
        newPassword: password,
        confirmPassword: password,
      })
    }
    expect(MAX_PASSWORD_LENGTH).toBe(1024)
    expect(at(MAX_PASSWORD_LENGTH).success).toBe(true)
    const tooLong = at(MAX_PASSWORD_LENGTH + 1)
    expect(tooLong.success).toBe(false)
    expect(tooLong.error?.issues.map((issue) => issue.path[0])).toContain('newPassword')
  })

  it('refuses any other field, so nobody can name another account', () => {
    const values = { currentPassword, newPassword: long, confirmPassword: long }
    expect(passwordChangeSchema.safeParse(values).success).toBe(true)
    expect(passwordChangeSchema.safeParse({ ...values, id: 1 }).success).toBe(false)
    expect(passwordChangeSchema.safeParse({ ...values, email: 'b@example.com' }).success).toBe(
      false,
    )
  })
})

describe('forgotPasswordSchema', () => {
  it('takes a trimmed email and nothing else', () => {
    expect(forgotPasswordSchema.parse({ email: ' ada@example.com ' })).toEqual({
      email: 'ada@example.com',
    })
    expect(forgotPasswordSchema.safeParse({ email: '  ' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'a@example.com', id: 1 }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  const valid = { token: 'a'.repeat(40), newPassword: 'new-secret', confirmPassword: 'new-secret' }

  it('takes the link’s token and a new password typed twice', () => {
    expect(resetPasswordSchema.parse(valid)).toEqual(valid)
  })

  it('applies the same password rules as changing it', () => {
    const short = 'p'.repeat(MIN_PASSWORD_LENGTH - 1)
    for (const values of [
      { ...valid, newPassword: short, confirmPassword: short },
      { ...valid, confirmPassword: 'different' },
    ]) {
      expect(resetPasswordSchema.safeParse(values).success).toBe(false)
      const { token: _token, ...fields } = values
      expect(newPasswordSchema.safeParse(fields).success).toBe(false)
    }
  })

  it('refuses a missing or oversized token, and any other field', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, token: '' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ ...valid, token: 'a'.repeat(129) }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ ...valid, email: 'a@example.com' }).success).toBe(false)
  })
})
