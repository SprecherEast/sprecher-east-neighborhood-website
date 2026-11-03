import type { Metadata } from 'next'

import { AccountOffer } from '@/modules/accounts/server'
import { parseConfirmationToken } from '@/modules/verification'
import { ConfirmEmail, getConfirmationLinkStatus } from '@/modules/verification/server'
import { privateAddressMetadata, type TokenLinkPageProps } from '@/platform/seo/privateAddress'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = privateAddressMetadata(
  'Confirm Your Email',
  'Confirm your email address for Sprecher East.',
)

/**
 * Where a confirmation link lands (#183). Confirming takes a click, not the page load; the page
 * only reads where the link stands, so a link opened again after confirming says so (#391). Once
 * the email is confirmed, the accounts module offers an account (#187): the two modules meet here.
 */
export default async function ConfirmEmailPage({ searchParams }: TokenLinkPageProps) {
  const { token } = await searchParams
  const status = await getConfirmationLinkStatus(token)
  const alreadyConfirmed = status === 'already-confirmed'

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title={alreadyConfirmed ? 'Email Confirmed' : 'Confirm Your Email'}
        description={
          alreadyConfirmed
            ? undefined
            : 'One click to confirm this address is yours. Then we’ll send you a welcome email.'
        }
      />
      {/* A dead link offers the contact form, where sending again brings a new link */}
      <ConfirmEmail token={parseConfirmationToken(token)} status={status} retryHref="/contact">
        <AccountOffer />
      </ConfirmEmail>
    </Section>
  )
}
