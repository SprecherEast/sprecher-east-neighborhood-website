import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { ACCOUNT_PATH, parseSocialProvider } from '@/modules/accounts'
import {
  ConnectGoogleClosed,
  ConnectGoogleForm,
  getCurrentUser,
  hasPendingGoogleLink,
} from '@/modules/accounts/server'
import { message } from '@/platform/lib'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = {
  title: 'Connect Google',
  description: 'Connect Google to your Sprecher East account.',
  robots: NOT_INDEXED,
}

// Depends on this browser's cookie
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ provider: string }> }

/**
 * Where Google's answer lands when an account already uses its verified email (#1338, decision
 * 0020): the neighbor enters that account's password once to connect Google. The page shows no
 * email and no Google id: what Google said stays on the server. A link that ran out, or a
 * browser that didn't ask for one, gets the one fixed message without the form, as a refused
 * password does: a try uses up what Google said, and the page is drawn again without it.
 */
export default async function ConnectGooglePage({ params }: Props) {
  if (!parseSocialProvider((await params).provider)) notFound()
  if (await getCurrentUser()) redirect(ACCOUNT_PATH)
  const open = await hasPendingGoogleLink()

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title="Connect Google"
        description={open ? message('accounts.google.passwordLead') : undefined}
      />
      {open ? <ConnectGoogleForm /> : <ConnectGoogleClosed />}
    </Section>
  )
}
