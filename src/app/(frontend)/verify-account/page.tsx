import type { Metadata } from 'next'

import { parseLinkToken } from '@/modules/accounts'
import { getVerificationLinkStatus, VerifyAccount } from '@/modules/accounts/server'
import { privateAddressMetadata, type TokenLinkPageProps } from '@/platform/seo/privateAddress'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = privateAddressMetadata(
  'Confirm Your Account',
  'Confirm the email of your new Sprecher East account.',
)

/**
 * Where the link in Payload's verification email lands (#187). Confirming takes a click, not the
 * page load; then the person logs in. The page only reads where the link stands, so a link opened
 * again after the account was verified says so (#391).
 */
export default async function VerifyAccountPage({ searchParams }: TokenLinkPageProps) {
  const { token } = await searchParams
  const status = await getVerificationLinkStatus(token)
  const alreadyVerified = status === 'already-verified'

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title={alreadyVerified ? 'Account Confirmed' : 'Confirm Your Account'}
        description={
          alreadyVerified
            ? undefined
            : 'One click to confirm this email is yours. Then log in with the password you chose.'
        }
      />
      <VerifyAccount token={parseLinkToken(token)} status={status} />
    </Section>
  )
}
