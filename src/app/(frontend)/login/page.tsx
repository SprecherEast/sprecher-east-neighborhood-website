import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ACCOUNT_PATH, SOCIAL_RESULT_PARAM } from '@/modules/accounts'
import {
  arePasskeysOn,
  getCurrentUser,
  getEnabledSocialProviders,
  SignInForm,
  SocialSignIn,
  SocialSignInMessage,
} from '@/modules/accounts/server'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

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
 * with `?social=<outcome>`, and the page shows its fixed message above them.
 */
export default async function LoginPage({ searchParams }: Props) {
  // Already signed in: nothing to do here
  if (await getCurrentUser()) redirect(ACCOUNT_PATH)
  const result = (await searchParams)[SOCIAL_RESULT_PARAM]

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
          passkeys={arePasskeysOn()}
          social={<SocialSignIn providers={getEnabledSocialProviders()} />}
        />
      </div>
    </Section>
  )
}
