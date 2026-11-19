import type { Metadata } from 'next'

import { parseLinkToken } from '@/modules/accounts'
import { ResetPasswordForm } from '@/modules/accounts/server'
import { privateAddressMetadata, type TokenLinkPageProps } from '@/platform/seo/privateAddress'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = privateAddressMetadata(
  'Choose a New Password',
  'Choose a new password for your Sprecher East account.',
)

/** Where a reset link lands (#269). Setting the password takes the form, not the page load. */
export default async function ResetPasswordPage({ searchParams }: TokenLinkPageProps) {
  const { token } = await searchParams

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title="Choose a New Password"
        description="Choose a new password for your account, then log in with it."
      />
      <ResetPasswordForm token={parseLinkToken(token)} />
    </Section>
  )
}
