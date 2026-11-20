import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ACCOUNT_PATH } from '@/modules/accounts'
import {
  getCurrentUser,
  getEnabledSocialProviders,
  SignUpForm,
  SocialSignIn,
} from '@/modules/accounts/server'
import { parseEmailAddress } from '@/platform/lib'
import { privateAddressMetadata } from '@/platform/seo/privateAddress'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = privateAddressMetadata(
  'Create an Account',
  'Create a free Sprecher East account.',
)

type Props = { searchParams: Promise<{ email?: string | string[] }> }

/**
 * Where a visitor creates an account (#187), with the email filled in when the confirm page's
 * "Yes" sent them. Nothing is created until the form is sent. Google sign-in sits above
 * the form, under one divider line, when it's on (#188, #1365).
 */
export default async function SignUpPage({ searchParams }: Props) {
  // Signed in: there is already an account
  if (await getCurrentUser()) redirect(ACCOUNT_PATH)
  const { email } = await searchParams

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title="Create an Account"
        description="A free account for Sprecher East. We’ll send you an email to confirm it before you log in."
      />
      <div className="space-y-6">
        <SignUpForm
          email={parseEmailAddress(email)}
          social={<SocialSignIn providers={getEnabledSocialProviders()} />}
        />
      </div>
    </Section>
  )
}
