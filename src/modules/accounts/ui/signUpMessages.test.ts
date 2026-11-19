import { describe, expect, it } from 'vitest'

import { FORM_MESSAGES } from '@/platform/ui'

import { SIGN_UP_SENT, toSignUpErrorMessage, toVerifyAccountErrorMessage } from './signUpMessages'

describe('sign-up messages', () => {
  it('never says whether an account already uses the email', () => {
    expect(SIGN_UP_SENT).toBe(
      'Almost there! Check your email for a link to finish signing up. Nothing yet? Look in spam, or try again.',
    )
    // The same text for everyone (#289), and no account is mentioned
    expect(SIGN_UP_SENT).not.toMatch(/account (uses|exists)/i)
  })

  it('has fixed texts for every failure', () => {
    expect(toSignUpErrorMessage('rejected')).toBe('Check the form and try again.')
    expect(toSignUpErrorMessage('offline')).toBe(FORM_MESSAGES.offline)
    expect(toSignUpErrorMessage('robot-check')).toMatch(/spam check/)
    expect(toSignUpErrorMessage('too-many')).toMatch(/try again in an hour/)
    expect(toVerifyAccountErrorMessage('invalid-link')).toMatch(/already used/)
    expect(toVerifyAccountErrorMessage('needs-password')).toMatch(/^Choose a password to finish/)
    expect(toVerifyAccountErrorMessage('server-error')).toMatch(/try again/)
    expect(toVerifyAccountErrorMessage('offline')).toBe(FORM_MESSAGES.offline)
  })
})
