import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { SIGN_IN_PATH } from '@/modules/accounts'
import {
  beginAuthorization,
  ConnectionNotice,
  ConsentCard,
  getViewer,
} from '@/modules/agents/server'
import { privateAddressMetadata } from '@/platform/seo/privateAddress'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

export const metadata: Metadata = privateAddressMetadata(
  'Connect an AI Tool',
  'Allow an AI tool to connect to the Sprecher East AI agent address.',
)

// The answer depends on the signed-in account and on the request, never on a cached page
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Where an AI tool sends an admin to allow it in (#1501). The request is checked before anything
 * is asked: a request that can't be trusted is explained here, one with an error goes back to the
 * tool, and only a signed-in admin sees the approval. The accounts and agents modules meet here.
 */
export default async function AuthorizePage({ searchParams }: Props) {
  const begun = await beginAuthorization(await searchParams, await getViewer())
  if (begun.kind === 'redirect') redirect(begun.url)

  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader
        variant="compact"
        title="Connect an AI Tool"
        description="Allow this tool to use the AI agent address."
      />
      {begun.kind === 'consent' ? (
        <ConsentCard view={begun.view} />
      ) : (
        <ConnectionNotice notice={begun} signInHref={SIGN_IN_PATH} />
      )}
    </Section>
  )
}
