import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ACCOUNT_PATH } from '@/modules/accounts'
import { ForgotPasswordForm, getCurrentUser } from '@/modules/accounts/server'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Get a link to choose a new password for your Sprecher East account.',
  robots: NOT_INDEXED,
}

/** Where a visitor asks for a link to reset a forgotten password (#269). */
export default async function ForgotPasswordPage() {
  // Signed in: the password is changed on the account page instead
  if (await getCurrentUser()) redirect(ACCOUNT_PATH)

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title="Forgot Your Password?"
        description="Enter the email you log in with. We’ll send you a link to choose a new password."
      />
      <ForgotPasswordForm />
    </Section>
  )
}
