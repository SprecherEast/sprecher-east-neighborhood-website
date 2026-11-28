import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ACCOUNT_PATH, RETURN_PARAM, safeReturnPath, SOCIAL_RESULT_PARAM } from '@/modules/accounts'
import {
  arePasskeysOn,
  getCurrentUser,
  getEnabledSocialProviders,
  SignInForm,
  SocialSignIn,
  SocialSignInMessage,
} from '@/modules/accounts/server'
import { OAUTH_PATHS } from '@/modules/agents'
import { message } from '@/platform/lib'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to your Sprecher East account.',
  robots: NOT_INDEXED,
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Where a visitor logs in. The quick ways come first and together (#1365): a passkey while the
 * switch is on (#1315), then Google when it's on (#188), then one divider line, then the email and
 * password form as the fallback. A provider sign-in that didn't open an account comes back here
 * with `?social=<outcome>`, and the page shows its fixed message above them. A page that needs
 * a log in first (the connection approval, #1501) sends `?next=` and gets the visitor back, only
 * when its path is on the list given here (`safeReturnPath`). While passkeys are on,
 * one line of fine print at the foot credits the passkey icon to its owner, as its terms ask.
 */
export default async function LoginPage({ searchParams }: Props) {
  const query = await searchParams
  // Only a page that asked to be returned to, so this page is never an open redirect
  const returnTo = safeReturnPath(query[RETURN_PARAM], [OAUTH_PATHS.approve])
  // Already signed in: nothing to do here
  if (await getCurrentUser()) redirect(returnTo ?? ACCOUNT_PATH)
  const result = query[SOCIAL_RESULT_PARAM]
  const passkeys = arePasskeysOn()

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title="Log In"
        description="Log in to your Sprecher East account."
      />
      <div className="space-y-6">
        <SocialSignInMessage result={result} />
        <SignInForm
          passkeys={passkeys}
          returnTo={returnTo ?? ACCOUNT_PATH}
          social={<SocialSignIn providers={getEnabledSocialProviders()} />}
        />
        {passkeys && <Text variant="small">{message('accounts.passkey.iconCredit')}</Text>}
      </div>
    </Section>
  )
}
