import { LogIn } from 'lucide-react'
import React from 'react'

import { Alert } from '@/platform/ui/Alert'
import { Button } from '@/platform/ui/Button'

import { SOCIAL_PROVIDER_NAMES, socialStartPath, type SocialProvider } from '../domain/socialSignIn'
import { parseSocialResult, SOCIAL_SIGN_IN_MESSAGES } from './socialSignInMessages'

type Props = {
  /** The providers that are on (`enabledProviders`); none shows nothing but the message */
  providers: SocialProvider[]
  /** The `?social=` value a provider sign-in came back with */
  result?: unknown
}

/**
 * "Continue with Google" on `/login` and `/sign-up` (#188), shown only when Google's keys are set,
 * and the fixed message a provider sign-in came back with. The button sends a plain GET form, so
 * the browser itself leaves the site for the provider: a link would be prefetched, and a client
 * navigation would start a sign-in nobody asked for. No brand logos: the kit's icons only
 * (`lucide-react`).
 */
export function SocialSignIn({ providers, result }: Props) {
  const message = parseSocialResult(result)
  if (providers.length === 0 && !message) return null
  return (
    <div className="space-y-4">
      {message && <Alert tone="error">{SOCIAL_SIGN_IN_MESSAGES[message]}</Alert>}
      {providers.length > 0 && (
        <div className="space-y-3">
          {providers.map((provider) => (
            <form key={provider} action={socialStartPath(provider)} method="get">
              <Button type="submit" variant="secondary" fullWidth iconStart={<LogIn aria-hidden />}>
                Continue with {SOCIAL_PROVIDER_NAMES[provider]}
              </Button>
            </form>
          ))}
          <p className="text-center text-sm text-muted-foreground">
            or use your email and password
          </p>
        </div>
      )}
    </div>
  )
}
