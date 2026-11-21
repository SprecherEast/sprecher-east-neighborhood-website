import React from 'react'

import { Alert } from '@/platform/ui/Alert'
import { BrandLogo } from '@/platform/ui/BrandLogo'
import { Button } from '@/platform/ui/Button'

import { SOCIAL_PROVIDER_NAMES, socialStartPath, type SocialProvider } from '../domain/socialSignIn'
import { SIGN_IN_BUTTON_SIZE } from './signInButton'
import { parseSocialResult, SOCIAL_SIGN_IN_MESSAGES } from './socialSignInMessages'

/**
 * The fixed message a provider sign-in came back with (`?social=<code>`) on `/login`, or nothing.
 * It sits above the quick ways in, so it is read first.
 */
export function SocialSignInMessage({ result }: { result?: unknown }) {
  const message = parseSocialResult(result)
  return message ? <Alert tone="error">{SOCIAL_SIGN_IN_MESSAGES[message]}</Alert> : null
}

/**
 * "Continue with Google" on `/login` and `/sign-up` (#188), shown only when Google's keys are set,
 * with Google's own full-colour "G" as its branding guidelines require (#1365). The button sends a
 * plain GET form, so the browser itself leaves the site for the provider: a link would be
 * prefetched, and a client navigation would start a sign-in nobody asked for. It draws only the
 * buttons: the page places them in `SignInMethods`, under the passkey, above the email form.
 */
export function SocialSignIn({ providers }: { providers: SocialProvider[] }) {
  return providers.map((provider) => (
    <form key={provider} action={socialStartPath(provider)} method="get">
      <Button
        type="submit"
        variant="secondary"
        fullWidth
        size={SIGN_IN_BUTTON_SIZE}
        iconStart={<BrandLogo brand={provider} />}
      >
        Continue with {SOCIAL_PROVIDER_NAMES[provider]}
      </Button>
    </form>
  ))
}
