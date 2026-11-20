import type { SocialSignInFailure } from '../domain/socialSignIn'
import { GUARD_MESSAGES } from './guardMessages'

/**
 * What `/login` says after a sign-in with Google that didn't open an account (#188).
 * Fixed texts only, never the provider's error (docs/guidelines/security.md).
 */
export const SOCIAL_SIGN_IN_MESSAGES: Record<SocialSignInFailure, string> = {
  failed:
    'We couldn’t sign you in with that account. Please try again, or log in with your email and password.',
  'no-email':
    'That account didn’t share an email address, and an account here needs one. Allow access to your email and try again, or sign up with your email.',
  unavailable:
    'We couldn’t sign you in to this account right now. Please try again later, or log in with your email and password.',
  'too-many': GUARD_MESSAGES['too-many'],
}

/** A `?social=` value from the address as a message key, or null when it isn't one. */
export function parseSocialResult(value: unknown): keyof typeof SOCIAL_SIGN_IN_MESSAGES | null {
  return typeof value === 'string' && Object.hasOwn(SOCIAL_SIGN_IN_MESSAGES, value)
    ? (value as keyof typeof SOCIAL_SIGN_IN_MESSAGES)
    : null
}
