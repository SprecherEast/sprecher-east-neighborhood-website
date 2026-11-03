import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ACCOUNT_PATH } from '@/modules/accounts'
import { getCurrentUser, SignUpForm } from '@/modules/accounts/server'
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
 * "Yes" sent them. Nothing is created until the form is sent.
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
      <SignUpForm email={parseEmailAddress(email)} />
    </Section>
  )
}
